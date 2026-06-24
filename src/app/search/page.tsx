import Link from "next/link";
import { SlidersHorizontal, SearchX, Coins, Trophy } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { searchCollections } from "@/server/collection/CollectionService";
import { getMyOverallRank } from "@/server/ranking/RankingService";
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
  const posts = await searchPosts({
    regionId: regionId || null,
    priceRange: priceRange || null,
    categoryIds,
    sort,
    q,
    excludeUserIds: blocked,
  });
  const { likedPosts, savedRestaurants } = await getViewerReactions(
    user?.id ?? null,
    posts.map((p) => p.id),
    posts.map((p) => p.restaurantId)
  );

  // 검색 의도(지역·상황·키워드)가 있을 때만 추천 큐레이션 지도 노출 — 신뢰순
  const hasQuery = !!(regionId || q.trim() || categoryIds.length);
  const collections = hasQuery
    ? await searchCollections({ regionId: regionId || null, categoryIds, q, excludeUserIds: blocked })
    : [];
  const colRanks = await Promise.all(collections.map((c) => getMyOverallRank(c.ownerId)));

  return (
    <main className="px-5 py-6">
      <BackHomeHeader title="검색" />
      <p className="mb-4 text-[13px] text-ink-muted">지역과 상황으로 가고 싶은 맛집을 찾아보세요.</p>

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

      {/* 개별 맛집 결과 */}
      <div className="mt-6">
        <p className="mb-3 text-sm text-ink-muted">맛집 {posts.length}곳</p>
        {posts.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="조건에 맞는 맛집이 없어요"
            description="검색어나 필터를 바꿔서 다시 찾아보세요."
          />
        ) : (
          <div className="space-y-4">
            {posts.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                liked={likedPosts.has(p.id)}
                saved={savedRestaurants.has(p.restaurantId)}
                isLoggedIn={!!user}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
