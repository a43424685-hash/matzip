import { NextResponse } from "next/server";
import { getSessionAdmin } from "@/lib/auth";
import { setCommunityPostBlind } from "@/server/community/CommunityService";

// 운영자: 커뮤니티 글 블라인드 토글(오탐 복구/재조치)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionAdmin();
  if (!me?.isAdmin) return NextResponse.json({ ok: false, reason: "FORBIDDEN" }, { status: 403 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  await setCommunityPostBlind(id, !!body.blinded, body.reason ? String(body.reason) : undefined);
  return NextResponse.json({ ok: true });
}
