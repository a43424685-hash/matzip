import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { searchPlaces } from "@/server/place/PlaceSearchService";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const q = new URL(req.url).searchParams.get("q") ?? "";
  if (!q.trim()) return NextResponse.json({ results: [] });

  const results = await searchPlaces(q);

  // 이미 등록된 가게 표시 — 같은 kakaoPlaceId 가 Restaurant 에 있으면 "내 방문 기록으로 추가"
  const placeIds = results.map((r) => r.kakaoPlaceId).filter((id): id is string => !!id);
  const existing =
    placeIds.length > 0
      ? await prisma.restaurant.findMany({
          where: { kakaoPlaceId: { in: placeIds } },
          select: { kakaoPlaceId: true },
        })
      : [];
  const registered = new Set(existing.map((r) => r.kakaoPlaceId));

  return NextResponse.json({
    results: results.map((r) => ({
      ...r,
      alreadyRegistered: r.kakaoPlaceId ? registered.has(r.kakaoPlaceId) : false,
    })),
  });
}
