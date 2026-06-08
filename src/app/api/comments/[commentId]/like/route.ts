import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { toggleCommentLike } from "@/server/comment/CommentService";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ commentId: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { commentId } = await params;
  try {
    const r = await toggleCommentLike(userId, commentId);
    return NextResponse.json({ ok: true, ...r });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
