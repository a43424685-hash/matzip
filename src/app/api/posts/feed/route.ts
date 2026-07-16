import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { searchPosts, type SortKey } from "@/server/restaurant/RestaurantService";
import { getBlockedIds } from "@/server/block/BlockService";
import { prisma } from "@/lib/db";

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

  // 이 페이지 글들에 대한 뷰어의 좋아요/저장 상태 — 2페이지부터 빈 하트로 보이던 문제 해결
  let liked: string[] = [];
  let saved: string[] = [];
  if (user && items.length > 0) {
    const [l, sv] = await Promise.all([
      prisma.like.findMany({
        where: { userId: user.id, postId: { in: items.map((i) => i.id) } },
        select: { postId: true },
      }),
      prisma.save.findMany({
        where: { userId: user.id, restaurantId: { in: items.map((i) => i.restaurantId) } },
        select: { restaurantId: true },
      }),
    ]);
    liked = l.map((x) => x.postId);
    saved = sv.map((x) => x.restaurantId);
  }

  return NextResponse.json({
    ok: true,
    items,
    liked,
    saved,
    hasMore: items.length === PAGE_SIZE,
  });
}
