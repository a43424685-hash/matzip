import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { recordShare } from "@/server/restaurant/RestaurantService";

/** 공유 버튼 클릭 기록 → 인증글이면 작성자에게 공유 XP (조건은 recordShare 참고) */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { postId } = await params;

  try {
    const result = await recordShare(userId, postId);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    const status = msg === "POST_NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
