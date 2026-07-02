import { NextResponse } from "next/server";
import { getSessionAdmin } from "@/lib/auth";
import { deleteCommunityPost } from "@/server/community/CommunityService";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionAdmin();
  if (!me) return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await params;
  const r = await deleteCommunityPost(me.id, id, me.isAdmin);
  if (!r.ok) return NextResponse.json({ ok: false, reason: r.reason }, { status: r.reason === "FORBIDDEN" ? 403 : 400 });
  return NextResponse.json({ ok: true });
}
