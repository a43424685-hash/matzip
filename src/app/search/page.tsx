import Link from "next/link";
import { SlidersHorizontal, SearchX, Coins, Trophy, MapPin, ChevronRight } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { searchCollections } from "@/server/collection/CollectionService";
import { geocodeKeyword } from "@/lib/kakaoGeocode";
import { getMyOverallRank, getTopRankerIds } from "@/server/ranking/RankingService";
import OfficialBadge from "@/components/OfficialBadge";
import EmptyState from "@/components/EmptyState";
import { getActiveRegions, getActiveCategories, groupCategoriesByType } from "@/server/catalog";
import {
  searchPosts,
  getViewerReactions,
  type SortKey,
} from "@/server/restaurant/RestaurantService";
import { getBlockedIds } from "@/server/block/BlockService";
import PostCard from "@/components/PostCard";
import SearchChip from "@/components/SearchChip";
import SearchBox from "@/components/SearchBox";
import { PRICE_RANGES, SORT_OPTIONS } from "@/lib/labels";
import BackHomeHeader from "@/components/BackHomeHeader";

export const dynamic = "force-dynamic";

const CAT_PRIORITY = [
  "야장", "노포", "가성비", "데이트", "비 오는 날", "혼밥", "분위기",
  "부모님 모시기 좋음", "가족", "겨울 국물", "신상", "회식",
];

function asArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const regionId = (sp.regionId as string) || "";
  const priceRange = (sp.priceRange as string) || "";
  // 기본 정렬 = 인기순(저장 많은순). 사용자가 필터에서 바꾸면 그 값 사용.
  const sort = ((sp.sort as string) || "saves") as SortKey;
  const categoryIds = asArray(sp.categoryIds);
  const q = (sp.q as string) || "";

  const [user, regions, categories] = await Promise.all([
    getCurrentUser(),
    getActiveRegions(),
    getActiveCategories(),
  ]);
  const groups = groupCategoriesByType(categories);

  // 추천 태그(핵심) 우선 노출
  const recommended = [...categories]
    .filter((c) => c.type === "situation" || c.type === "season")
    .sort((a, b) => {
      const ia = CAT_PRIORITY.indexOf(a.name);
      const ib = CAT_PRIORITY.indexOf(b.name);
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    })
    .slice(0, 8);
  const recommendedIds = new Set(recommended.map((c) => c.id));

  const blocked = await getBlockedIds(user?.id ?? null);

  // 검색어에서 분류 단어(야장·노포·카페 등)를 자동으로 뽑아 "위치"와 "분류"를 분리한다.
  //   예) "수유 야장" → 위치 "수유" + 분류 [야장]  → 수유의 야장 맛집만.
  // (분류는 칩으로만 걸리던 걸, 글로 친 경우도 인식하도록.)
  const derivedCatIds: string[] = [];
  const catWords: string[] = []; // 검색어에서 뽑은 분류어(야장 등) — 리뷰 글 매칭용
  let locationQuery = q;
  for (const c of categories) {
    if (c.name.length >= 2 && q.includes(c.name)) {
      derivedCatIds.push(c.id);
      catWords.push(c.name);
      locationQuery = locationQuery.split(c.name).join(" ");
    }
  }
  // 의미 없는 일반어 제거 후 위치 부분만 남김
  locationQuery = locationQuery.replace(/맛집|식당|추천|근처/g, " ").replace(/\s+/g, " ").trim();
  const effectiveCategoryIds = Array.from(new Set([...categoryIds, ...derivedCatIds]));

  // 위치 부분이 있으면 그것만 지오코딩(없으면 분류만으로 검색)
  const coords = locationQuery ? await geocodeKeyword(locationQuery) : null;
  const posts = await searchPosts({
    regionId: regionId || null,
    priceRange: priceRange || null,
    categoryIds: effectiveCategoryIds,
    keywordTerms: catWords,
    sort,
    q: locationQuery,
    coords,
    excludeUserIds: blocked,
  });
  const { likedPosts, savedRestaurants } = await getViewerReactions(
    user?.id ?? null,
    posts.map((p) => p.id),
    posts.map((p) => p.restaurantId)
  );

  // 검색 의도(지역·상황·키워드)가 있을 때만 추천 큐레이션 지도 노출 — 신뢰순
  // 위치는 지오코딩(검색어→좌표)으로 받고, 상황은 카테고리로. "충무로역 3번출구" 같은 것도 좌표로 해석됨.
  // 추천 지도는 검색어가 "실제로" 위치(좌표)·지역·카테고리로 해석됐을 때만 노출.
  // "zzzz" 처럼 아무 글자나 친 경우엔 coords=null + 지역/카테고리 없음 → 추천 안 띄움(광고처럼 튀는 것 방지).
  const hasResolvedIntent = !!(coords || regionId || effectiveCategoryIds.length);
  const collections = hasResolvedIntent
    ? await searchCollections({ coords, regionId: regionId || null, categoryIds: effectiveCategoryIds, excludeUserIds: blocked })
    : [];
  const colRanks = await Promise.all(collections.map((c) => getMyOverallRank(c.ownerId)));
  const topRankers = await getTopRankerIds();

  return (
    <main className="px-5 py-6">
      <BackHomeHeader title="검색" />
      <p className="mb-4 text-[13px] text-ink-muted">지역과 상황으로 가고 싶은 맛집을 찾아보세요.</p>

      {q && (
        <a
          href={`/nearby?q=${encodeURIComponent(q)}`}
          className="mb-4 flex items-center justify-between rounded-2xl border border-forest/20 bg-forest-soft/30 p-4 active:scale-[0.99]"
        >
          <span className="flex items-center gap-2 text-sm font-bold text-ink">
            <MapPin size={17} className="text-forest" /> ‘{q}’ 지도로 보기
          </span>
          <ChevronRight size={17} className="text-forest" />
        </a>
      )}

      <form method="get" className="space-y-4">
        {/* 가게 이름 키워드 검색 — 최근 검색어 + 자동완성 */}
        <SearchBox initialQ={q} />

        {/* 추천 태그 — 핵심 카테고리 우선 */}
        <div className="flex flex-wrap gap-2">
          {recommended.map((c) => (
            <SearchChip key={c.id} id={c.id} name={c.name} checked={categoryIds.includes(c.id)} />
          ))}
        </div>

        {/* 필터 — 지역·가격·정렬·전체 카테고리 (기본 접힘) */}
        <details
          className="rounded-2xl border border-stone-200"
          open={!!regionId || !!priceRange || sort !== "saves" || categoryIds.some((id) => !recommendedIds.has(id))}
        >
          <summary className="flex cursor-pointer list-none items-center gap-1.5 px-4 py-3 text-sm font-semibold text-ink">
            <SlidersHorizontal size={16} className="text-forest" /> 필터
            <span className="text-xs font-normal text-stone-400">지역 · 가격 · 정렬 · 전체 카테고리</span>
          </summary>
          <div className="space-y-3 border-t border-stone-100 px-4 py-4">
            <div className="grid grid-cols-2 gap-2">
              <select name="regionId" defaultValue={regionId} className="input h-11">
                <option value="">지역 전체</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <select name="sort" defaultValue={sort} className="input h-11">
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <select name="priceRange" defaultValue={priceRange} className="input h-11">
              <option value="">가격대 전체</option>
              {PRICE_RANGES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            {groups.map((g) => {
              const items = g.items.filter((c) => !recommendedIds.has(c.id));
              if (items.length === 0) return null;
              return (
                <div key={g.type}>
                  <p className="mb-2 text-xs font-semibold text-stone-400">{g.label}</p>
                  <div className="flex flex-wrap gap-2">
                    {items.map((c) => (
                      <SearchChip key={c.id} id={c.id} name={c.name} checked={categoryIds.includes(c.id)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </details>

        <button type="submit" className="btn-primary h-12 w-full !text-base">
          검색
        </button>
      </form>

      {/* 추천 큐레이션 지도 — 신뢰순 (검증된 미식가의 정리된 리스트) */}
      {collections.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-extrabold text-ink">
            <Coins size={16} className="text-forest" /> 추천 맛집 지도
            <span className="font-bold text-ink-muted">{collections.length}</span>
          </h2>
          <div className="space-y-2.5">
            {collections.map((c, i) => (
              <Link
                key={c.id}
                href={`/collections/${c.id}`}
                className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-3"
              >
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-stone-100">
                  {c.thumbnailUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.thumbnailUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-ink">{c.title}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] text-ink-muted">
                    <span className="rounded bg-coral px-1 py-0.5 text-[10px] font-extrabold text-white">Lv.{c.ownerLevel}</span>
                    {colRanks[i] > 0 && (
                      <span className="flex items-center gap-0.5 font-bold text-amber-600">
                        <Trophy size={10} /> 전체 {colRanks[i]}위
                      </span>
                    )}
                    <span className="font-semibold text-ink">{c.ownerNickname}</span>
                    {c.ownerIsAdmin && <OfficialBadge size={13} />}
                    <span>· {c.regionName} · {c.itemCount}곳</span>
                  </div>
                </div>
                {c.isPaid ? (
                  <span className="shrink-0 text-sm font-black text-forest">{(c.priceWon ?? 0).toLocaleString()}원</span>
                ) : (
                  <span className="shrink-0 rounded-md bg-forest-soft px-1.5 py-0.5 text-[11px] font-bold text-forest">무료</span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 개별 맛집 결과 — 추천 지도가 있으면 빈 결과는 숨김 */}
      {(posts.length > 0 || collections.length === 0) && (
        <div className="mt-6">
          <p className="mb-3 text-sm text-ink-muted">맛집 {posts.length}곳</p>
          {posts.length === 0 ? (
            <div>
              <EmptyState
                icon={SearchX}
                title={q.trim() ? `‘${q.trim()}’ 근처엔 아직 맛집이 적어요` : "조건에 맞는 맛집이 없어요"}
                description={
                  q.trim()
                    ? "이 동네의 첫 맛집을 등록하거나, 인기 맛집을 둘러보세요."
                    : "검색어나 필터를 바꿔서 다시 찾아보세요."
                }
              />
              <div className="mt-4 flex flex-col gap-2">
                <Link href="/register" className="btn-primary flex h-11 w-full items-center justify-center">
                  첫 맛집 등록하기
                </Link>
                <Link
                  href="/rankings"
                  className="flex h-11 w-full items-center justify-center rounded-xl border border-stone-200 bg-white text-sm font-semibold text-ink"
                >
                  인기 맛집 둘러보기
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((p) => (
                <PostCard
                  key={p.id}
                  post={p}
                  liked={likedPosts.has(p.id)}
                  saved={savedRestaurants.has(p.restaurantId)}
                  isLoggedIn={!!user}
                  authorIsRanker={topRankers.has(p.authorId)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
