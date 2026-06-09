import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  getViewerReactions,
  postCardSelect,
  toPostCard,
} from "@/server/restaurant/RestaurantService";
import { getBlockedIds } from "@/server/block/BlockService";

export const dynamic = "force-dynamic";

const R = 6371000;

function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number) {
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ ok: false, error: "위치 정보가 필요합니다." }, { status: 400 });
  }

  const user = await getCurrentUser();
  const blockedIds = await getBlockedIds(user?.id ?? null);
  const posts = await prisma.restaurantPost.findMany({
    where: {
      restaurant: { latitude: { not: null }, longitude: { not: null } },
      OR: [{ locationVerified: true }, { user: { isAdmin: true } }],
      user: { deactivatedAt: null },
      ...(blockedIds.length > 0 ? { userId: { notIn: blockedIds } } : {}),
    },
    orderBy: [{ saveCount: "desc" }, { likeCount: "desc" }, { createdAt: "desc" }],
    take: 80,
    select: {
      ...postCardSelect,
      restaurant: {
        select: {
          id: true,
          name: true,
          latitude: true,
          longitude: true,
          primaryRegion: { select: { id: true, name: true } },
        },
      },
    },
  });

  const sorted = posts
    .map((p) => ({
      post: toPostCard(p),
      latitude: p.restaurant.latitude,
      longitude: p.restaurant.longitude,
      distanceMeters:
        p.restaurant.latitude == null || p.restaurant.longitude == null
          ? null
          : distanceMeters(lat, lng, p.restaurant.latitude, p.restaurant.longitude),
    }))
    .filter((p): p is { post: ReturnType<typeof toPostCard>; latitude: number; longitude: number; distanceMeters: number } => p.distanceMeters != null && p.latitude != null && p.longitude != null)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, 50);

  const { likedPosts, savedRestaurants } = await getViewerReactions(
    user?.id ?? null,
    sorted.map((p) => p.post.id),
    sorted.map((p) => p.post.restaurantId)
  );

  return NextResponse.json({
    ok: true,
    items: sorted.map((p) => ({
      ...p,
      liked: likedPosts.has(p.post.id),
      saved: savedRestaurants.has(p.post.restaurantId),
    })),
    isLoggedIn: !!user,
  });
}
