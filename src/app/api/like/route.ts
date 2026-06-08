import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { toggleLike } from "@/server/restaurant/RestaurantService";

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { postId } = await req.json();
  if (!postId) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });

  const result = await toggleLike(userId, postId);
  return NextResponse.json(result);
}
