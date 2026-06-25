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
  // 반경 제한(기본 3km) — 이 안의 맛집만 "주변"으로 인정
  const radius = Number(url.searchParams.get("radius")) || 3000;

  // 스케일 대비: DB에서 bounding box(위경도 범위)로 먼저 좁힌 뒤, 아래에서 JS 원형 거리로 정밀 필터.
  // (전역 스캔 대신 인덱스 가능한 범위 조건 — Restaurant @@index([latitude, longitude]))
  const latDelta = radius / 111_320; // 위도 1도 ≈ 111.32km
  const cos = Math.cos((lat * Math.PI) / 180);
  const lngDelta = radius / (111_320 * (Math.abs(cos) < 1e-6 ? 1e-6 : cos));

  const user = await getCurrentUser();
  const blockedIds = await getBlockedIds(user?.id ?? null);
  // 유료/무료 분리: 유료 지도에 잠긴(맛보기 아님) 글은 주변(무료)에서 제외
  const lockedItems = await prisma.collectionItem.findMany({
    where: { isPreview: false, postId: { not: null }, collection: { isPaid: true } },
    select: { postId: true },
  });
  const lockedIds = lockedItems.map((l) => l.postId).filter((x): x is string => !!x);
  const posts = await prisma.restaurantPost.findMany({
    where: {
      restaurant: {
        latitude: { gte: lat - latDelta, lte: lat + latDelta },
        longitude: { gte: lng - lngDelta, lte: lng + lngDelta },
      },
      OR: [{ locationVerified: true }, { user: { isAdmin: true } }],
      user: { deactivatedAt: null },
      ...(blockedIds.length > 0 ? { userId: { notIn: blockedIds } } : {}),
      ...(lockedIds.length > 0 ? { id: { notIn: lockedIds } } : {}),
    },
    orderBy: [{ saveCount: "desc" }, { likeCount: "desc" }, { createdAt: "desc" }],
    take: 200,
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
    .filter((p) => p.distanceMeters <= radius)
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
