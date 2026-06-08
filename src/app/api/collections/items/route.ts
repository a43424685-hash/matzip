import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { toggleItem } from "@/server/collection/CollectionService";

// 컬렉션에 음식점 담기/빼기 토글
export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { collectionId, restaurantId } = await req.json();
  if (!collectionId || !restaurantId) {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  }
  try {
    const result = await toggleItem(userId, collectionId, restaurantId);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
}
