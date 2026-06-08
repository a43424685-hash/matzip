import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { blockUser, unblockUser } from "@/server/block/BlockService";

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const blockedId = String(body.blockedId ?? "");
  if (!blockedId) return NextResponse.json({ ok: false, reason: "BAD_REQUEST" }, { status: 400 });
  const r = await blockUser(userId, blockedId);
  if (!r.ok) {
    const status = r.reason === "SELF" ? 400 : r.reason === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json(r, { status });
  }
  return NextResponse.json(r);
}

export async function DELETE(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const blockedId = String(body.blockedId ?? "");
  if (!blockedId) return NextResponse.json({ ok: false, reason: "BAD_REQUEST" }, { status: 400 });
  await unblockUser(userId, blockedId);
  return NextResponse.json({ ok: true });
}
