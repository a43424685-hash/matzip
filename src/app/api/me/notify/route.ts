import { NextResponse } from "next/server";
import { getActiveUserId } from "@/lib/auth";
import { updateNotifyPrefs } from "@/server/account/AccountService";

export async function POST(req: Request) {
  const userId = await getActiveUserId();
  if (!userId) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  await updateNotifyPrefs(userId, {
    notifyLike: body.notifyLike !== false,
    notifyComment: body.notifyComment !== false,
  });
  return NextResponse.json({ ok: true });
}
