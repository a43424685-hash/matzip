import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { toggleCommunityLike } from "@/server/community/CommunityService";

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const postId = String(body.postId ?? "");
  if (!postId) return NextResponse.json({ ok: false, reason: "BAD_REQUEST" }, { status: 400 });
  const r = await toggleCommunityLike(userId, postId);
  return NextResponse.json({ ok: true, ...r });
}
