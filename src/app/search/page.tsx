import { Search, SlidersHorizontal } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getActiveRegions, getActiveCategories, groupCategoriesByType } from "@/server/catalog";
import {
  searchPosts,
  getViewerReactions,
  type SortKey,
} from "@/server/restaurant/RestaurantService";
import { getBlockedIds } from "@/server/block/BlockService";
import PostCard from "@/components/PostCard";
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

const CHIP =
  "flex cursor-pointer items-center rounded-full border border-stone-200 bg-white px-3.5 py-2 text-sm font-medium text-ink transition active:scale-95 has-[:checked]:border-forest has-[:checked]:bg-forest has-[:checked]:text-white";

function CatChip({ id, name, checked }: { id: string; name: string; checked: boolean }) {
  return (
    <label className={CHIP}>
      <input type="checkbox" name="categoryIds" value={id} defaultChecked={checked} className="sr-only" />
      {name}
    </label>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const regionId = (sp.regionId as string) || "";
  const priceRange = (sp.priceRange as string) || "";
  const sort = ((sp.sort as string) || "latest") as SortKey;
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

  const posts = await searchPosts({
    regionId: regionId || null,
    priceRange: priceRange || null,
    categoryIds,
    sort,
    q,
    excludeUserIds: await getBlockedIds(user?.id ?? null),
  });
  const { likedPosts, savedRestaurants } = await getViewerReactions(
    user?.id ?? null,
    posts.map((p) => p.id),
    posts.map((p) => p.restaurantId)
  );

  return (
    <main className="px-5 py-6">
      <BackHomeHeader title="검색" />
      <p className="mb-4 text-[13px] text-ink-muted">지역과 상황으로 가고 싶은 맛집을 찾아보세요.</p>

      <form method="get" className="space-y-4">
        {/* 가게 이름 키워드 검색 */}
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            name="q"
            defaultValue={q}
            placeholder="가게 이름으로 검색"
            className="input h-12 !pl-10"
            autoComplete="off"
          />
        </div>

        {/* 추천 태그 — 핵심 카테고리 우선 */}
        <div className="flex flex-wrap gap-2">
          {recommended.map((c) => (
            <CatChip key={c.id} id={c.id} name={c.name} checked={categoryIds.includes(c.id)} />
          ))}
        </div>

        {/* 필터 — 지역·가격·정렬·전체 카테고리 (기본 접힘) */}
        <details
          className="rounded-2xl border border-stone-200"
          open={!!regionId || !!priceRange || sort !== "latest" || categoryIds.some((id) => !recommendedIds.has(id))}
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
                      <CatChip key={c.id} id={c.id} name={c.name} checked={categoryIds.includes(c.id)} />
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

      {/* 결과 */}
      <div className="mt-6">
        <p className="mb-3 text-sm text-ink-muted">{posts.length}개 결과</p>
        {posts.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">조건에 맞는 맛집이 없어요.</p>
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
