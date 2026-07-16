import { NextResponse } from "next/server";
import { getActiveUserId, getSessionAdmin } from "@/lib/auth";
import { deleteCommunityComment } from "@/server/community/CommunityService";

// 커뮤니티 댓글 삭제 — 작성자 본인 또는 운영자
export async function DELETE(_req: Request, { params }: { params: Promise<{ commentId: string }> }) {
  const userId = await getActiveUserId();
  if (!userId) return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  const admin = await getSessionAdmin();
  const { commentId } = await params;
  const r = await deleteCommunityComment(userId, commentId, admin?.isAdmin ?? false);
  if (!r.ok) {
    const status = r.reason === "NOT_FOUND" ? 404 : r.reason === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json(r, { status });
  }
  return NextResponse.json({ ok: true });
}
