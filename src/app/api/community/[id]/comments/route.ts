import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { addCommunityComment } from "@/server/community/CommunityService";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const r = await addCommunityComment(userId, id, String(body.content ?? ""));
  if (!r.ok) return NextResponse.json({ ok: false, reason: r.reason }, { status: 400 });
  return NextResponse.json({ ok: true });
}
