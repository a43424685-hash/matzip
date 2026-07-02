import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { followUser, unfollowUser } from "@/server/follow/FollowService";

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const targetId = String(body.targetId ?? "");
  if (!targetId || targetId === userId) {
    return NextResponse.json({ ok: false, reason: "BAD_REQUEST" }, { status: 400 });
  }
  await followUser(userId, targetId);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const targetId = String(body.targetId ?? "");
  if (!targetId || targetId === userId) {
    return NextResponse.json({ ok: false, reason: "BAD_REQUEST" }, { status: 400 });
  }
  await unfollowUser(userId, targetId);
  return NextResponse.json({ ok: true });
}
