import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { postCardSelect, toPostCard } from "@/server/restaurant/RestaurantService";
import { getBlockedIds } from "@/server/block/BlockService";
import { visiblePostWhere } from "@/server/visibility/PaidVisibility";
import { getCurrentWeather, WEATHER_CATEGORIES } from "@/lib/weather";

export const dynamic = "force-dynamic";

const R = 6371000;
const NEAR_RADIUS = 8000; // 8km 이내는 "주변"으로 보고 우선 노출
const DEMO_POST_ID_PREFIX = "demo-p";
const DEMO_USER_ID_PREFIX = "demo-u";

function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number) {
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ ok: false, error: "위치 정보가 필요합니다." }, { status: 400 });
  }

  const weather = await getCurrentWeather(lat, lng);
  if (!weather) {
    // 키 미설정/조회 실패 — 섹션을 숨기도록 ok:false
    return NextResponse.json({ ok: false, error: "날씨 정보를 가져오지 못했어요." });
  }

  const catNames = WEATHER_CATEGORIES[weather.condition];
  const cats = await prisma.category.findMany({
    where: { name: { in: catNames } },
    select: { id: true },
  });
  const categoryIds = cats.map((c) => c.id);

  const user = await getCurrentUser();
  const blockedIds = await getBlockedIds(user?.id ?? null);
  const visibleCond = await visiblePostWhere(user?.id ?? null);

  // 매칭 카테고리의 공개 글 — 인기순으로 넉넉히 뽑은 뒤 아래에서 주변 우선 재정렬
  const posts = categoryIds.length
    ? await prisma.restaurantPost.findMany({
        where: {
          categories: { some: { categoryId: { in: categoryIds } } },
          AND: [visibleCond],
          visibility: "public",
          user: { id: { not: { startsWith: DEMO_USER_ID_PREFIX } }, deactivatedAt: null },
          ...(blockedIds.length > 0 ? { userId: { notIn: blockedIds } } : {}),
          id: { not: { startsWith: DEMO_POST_ID_PREFIX } },
        },
        orderBy: [{ saveCount: "desc" }, { likeCount: "desc" }, { createdAt: "desc" }],
        take: 80,
        select: {
          ...postCardSelect,
          restaurant: {
            select: {
              id: true,
              name: true,
              saveCount: true,
              latitude: true,
              longitude: true,
              signatureMenu: true,
              extRating: true,
              extReviewCount: true,
              primaryRegion: { select: { id: true, name: true } },
            },
          },
        },
      })
    : [];

  // 주변(8km 이내) 우선 → 그다음 인기순(원래 정렬 유지). 데이터 적어도 안 비게 폴백.
  const withDist = posts.map((p) => {
    const rLat = p.restaurant.latitude;
    const rLng = p.restaurant.longitude;
    const d = rLat != null && rLng != null ? distanceMeters(lat, lng, rLat, rLng) : null;
    return { post: toPostCard(p), distanceMeters: d };
  });
  const near = withDist
    .filter((p) => p.distanceMeters != null && p.distanceMeters <= NEAR_RADIUS)
    .sort((a, b) => (a.distanceMeters! - b.distanceMeters!));
  const rest = withDist.filter((p) => !(p.distanceMeters != null && p.distanceMeters <= NEAR_RADIUS));
  const items = [...near, ...rest].slice(0, 12);

  return NextResponse.json({
    ok: true,
    weather: {
      condition: weather.condition,
      tempC: weather.tempC,
      humidity: weather.humidity,
      emoji: weather.emoji,
      label: weather.label,
    },
    categories: catNames,
    items,
  });
}
