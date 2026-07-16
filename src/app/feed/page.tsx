import { getCurrentUser } from "@/lib/auth";
import { getBlockedIds } from "@/server/block/BlockService";
import {
  searchPosts,
  getViewerReactions,
  type SortKey,
} from "@/server/restaurant/RestaurantService";
import { Search } from "lucide-react";
import BackHomeHeader from "@/components/BackHomeHeader";
import InfiniteList from "@/components/InfiniteList";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

// 정렬 파라미터(weekly|latest|saves) → searchPosts SortKey. 기본은 인기순(saves).
const SORT_MAP: Record<string, SortKey> = { weekly: "weekly", latest: "latest", saves: "saves" };

function title(sort: string): string {
  if (sort === "weekly") return "이번주 인기 맛집";
  if (sort === "latest") return "갓 올라온 맛집";
  return "맛집 전체";
}

export default async function FeedListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const sortParam = (sp.sort as string) || "saves";
  const sort: SortKey = SORT_MAP[sortParam] ?? "saves";
  const q = (sp.q as string) || undefined;
  const regionId = (sp.regionId as string) || undefined;
  const priceRange = (sp.priceRange as string) || undefined;
  const categoryIds = sp.categoryIds
    ? Array.isArray(sp.categoryIds)
      ? sp.categoryIds
      : [sp.categoryIds]
    : [];

  const user = await getCurrentUser();
  const excludeUserIds = await getBlockedIds(user?.id ?? null);

  // 첫 페이지 서버 렌더 (skip:0)
  const items = await searchPosts({
    sort,
    q,
    regionId,
    priceRange,
    categoryIds,
    limit: PAGE_SIZE,
    skip: 0,
    excludeUserIds,
    viewerId: user?.id ?? null,
    includeUnverified: sort === "latest",
  });

  const { likedPosts, savedRestaurants } = await getViewerReactions(
    user?.id ?? null,
    items.map((p) => p.id),
    items.map((p) => p.restaurantId)
  );

  // "더보기" 시 API 가 받을 동일 쿼리 (정렬/검색/필터 유지)
  const query: Record<string, string> = { sort: sortParam };
  if (q) query.q = q;
  if (regionId) query.regionId = regionId;
  if (priceRange) query.priceRange = priceRange;
  // categoryIds 는 다중 값 — 콤마로 합쳐 보내고 InfiniteList가 반복 파라미터로 풀어 보낸다
  if (categoryIds.length > 0) query.categoryIdsCsv = categoryIds.join(",");

  return (
    <main className="px-5 py-6">
      <BackHomeHeader title={title(sortParam)} />
      {/* 검색은 /search로 안 튀고 이 화면(/feed)에서 바로 결과가 갱신됨. 정렬(이번주/갓올라온)은 유지. */}
      <form action="/feed" method="get" className="mb-4 flex h-11 items-center gap-2 rounded-full bg-stone-100 px-4">
        <input type="hidden" name="sort" value={sortParam} />
        {regionId && <input type="hidden" name="regionId" value={regionId} />}
        {priceRange && <input type="hidden" name="priceRange" value={priceRange} />}
        {categoryIds.map((id) => (
          <input key={id} type="hidden" name="categoryIds" value={id} />
        ))}
        <Search size={17} className="shrink-0 text-stone-400" />
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="맛집·지역 검색"
          className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-stone-400"
        />
      </form>
      {items.length === 0 ? (
        <p className="mx-1 rounded-2xl bg-stone-50 py-10 text-center text-sm text-stone-400">
          {q ? `‘${q}’ 검색 결과가 없어요.` : "아직 등록된 맛집이 없어요."}
        </p>
      ) : (
        <InfiniteList
          initialItems={items}
          query={query}
          initialLiked={[...likedPosts]}
          initialSaved={[...savedRestaurants]}
          isLoggedIn={!!user}
        />
      )}
    </main>
  );
}
