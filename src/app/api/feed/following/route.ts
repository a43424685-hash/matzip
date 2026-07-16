import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { toPostCard, postCardSelect } from "@/server/restaurant/RestaurantService";
import { getBlockedIds } from "@/server/block/BlockService";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

// 팔로잉 피드 페이지네이션 — 팔로우한 사람들이 인증한 공개 맛집, 최신순.
export async function GET(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ items: [], hasMore: false });

  const skip = Math.max(0, Number(new URL(req.url).searchParams.get("skip")) || 0);

  const [follows, blocked] = await Promise.all([
    prisma.follow.findMany({ where: { followerId: userId }, select: { followingId: true } }),
    getBlockedIds(userId),
  ]);
  const blockedSet = new Set(blocked);
  const ids = follows.map((f) => f.followingId).filter((id) => !blockedSet.has(id));
  if (ids.length === 0) return NextResponse.json({ items: [], hasMore: false });

  const rows = await prisma.restaurantPost.findMany({
    where: { userId: { in: ids }, visibility: "public", locationVerified: true },
    orderBy: { createdAt: "desc" },
    skip,
    take: PAGE_SIZE,
    select: postCardSelect,
  });
  const items = rows.map(toPostCard);
  return NextResponse.json({ items, hasMore: items.length === PAGE_SIZE });
}
