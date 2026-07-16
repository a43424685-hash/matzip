import { NextResponse } from "next/server";
import { getActiveUserId } from "@/lib/auth";
import { toggleSave } from "@/server/restaurant/RestaurantService";

export async function POST(req: Request) {
  const userId = await getActiveUserId();
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { restaurantId, postId } = await req.json();
  if (!restaurantId) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });

  const result = await toggleSave(userId, restaurantId, postId ?? null);
  return NextResponse.json(result);
}
