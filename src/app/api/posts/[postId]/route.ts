import { NextResponse } from "next/server";
import { getSessionAdmin } from "@/lib/auth";
import { deletePost } from "@/server/restaurant/RestaurantService";

// 글 삭제 — 작성자 본인 또는 운영자
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const me = await getSessionAdmin();
  if (!me) return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  const { postId } = await params;
  const r = await deletePost(me.id, postId, me.isAdmin);
  if (!r.ok) {
    const status = r.reason === "FORBIDDEN" ? 403 : r.reason === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json(r, { status });
  }
  return NextResponse.json(r);
}
