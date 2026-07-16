import { NextResponse } from "next/server";
import { getActiveUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  listMyCollections,
  createCollection,
  toggleItem,
} from "@/server/collection/CollectionService";

// 내 컬렉션 목록 (+ 특정 음식점 포함 여부)
export async function GET(req: Request) {
  const userId = await getActiveUserId();
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const restaurantId = new URL(req.url).searchParams.get("restaurantId") ?? undefined;
  const collections = await listMyCollections(userId, restaurantId);
  return NextResponse.json({ collections });
}

// 새 컬렉션 생성 (+ 옵션: 만들면서 음식점 바로 담기)
export async function POST(req: Request) {
  const userId = await getActiveUserId();
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { title, restaurantId } = await req.json();
  if (!title || !String(title).trim()) {
    return NextResponse.json({ error: "TITLE_REQUIRED" }, { status: 400 });
  }
  // 인라인 생성은 음식점 화면에서만 → 대표 지역은 그 음식점의 지역으로 자동 설정
  if (!restaurantId) {
    return NextResponse.json({ error: "RESTAURANT_REQUIRED" }, { status: 400 });
  }
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { primaryRegionId: true },
  });
  if (!restaurant) {
    return NextResponse.json({ error: "RESTAURANT_NOT_FOUND" }, { status: 404 });
  }
  const col = await createCollection({
    userId,
    title: String(title),
    regionId: restaurant.primaryRegionId,
  });
  await toggleItem(userId, col.id, restaurantId);
  return NextResponse.json({ id: col.id, title: String(title).trim() });
}
