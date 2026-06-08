import { NextResponse } from "next/server";
import { getSessionAdmin } from "@/lib/auth";
import { deleteComment } from "@/server/comment/CommentService";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ commentId: string }> }
) {
  const me = await getSessionAdmin();
  if (!me) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { commentId } = await params;
  try {
    const r = await deleteComment(me.id, commentId, me.isAdmin);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    const code = e instanceof Error ? e.message : "ERROR";
    const status = code === "FORBIDDEN" ? 403 : code === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ ok: false, reason: code }, { status });
  }
}
