import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { searchPosts, type SortKey } from "@/server/restaurant/RestaurantService";
import { getBlockedIds } from "@/server/block/BlockService";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

// 정렬 파라미터(weekly|latest|saves) → searchPosts SortKey. 기본은 인기순(saves).
const SORT_MAP: Record<string, SortKey> = { weekly: "weekly", latest: "latest", saves: "saves" };

// 맛집 전체 피드 — "더보기" 오프셋 페이지네이션. 공개(비로그인 허용).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const sp = url.searchParams;

  const sortParam = sp.get("sort") || "saves";
  const sort: SortKey = SORT_MAP[sortParam] ?? "saves";
  const skip = Math.max(0, Number(sp.get("skip")) || 0);
  const q = sp.get("q") || undefined;
  const regionId = sp.get("regionId") || undefined;
  const priceRange = sp.get("priceRange") || undefined;
  const categoryIds = sp.getAll("categoryIds");

  // 로그인했으면 차단한 사용자 글 제외(비로그인은 빈 배열)
  const user = await getCurrentUser();
  const excludeUserIds = await getBlockedIds(user?.id ?? null);

  const items = await searchPosts({
    sort,
    q,
    regionId,
    priceRange,
    categoryIds,
    limit: PAGE_SIZE,
    skip,
    excludeUserIds,
    viewerId: user?.id ?? null,
    includeUnverified: sort === "latest",
  });

  return NextResponse.json({
    ok: true,
    items,
    hasMore: items.length === PAGE_SIZE,
  });
}
