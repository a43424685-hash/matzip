import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { togglePinComment } from "@/server/comment/CommentService";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ commentId: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { commentId } = await params;
  try {
    const r = await togglePinComment(userId, commentId);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    const code = e instanceof Error ? e.message : "ERROR";
    const status = code === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json({ ok: false, reason: code }, { status });
  }
}
