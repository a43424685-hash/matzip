import { NextResponse } from "next/server";
import { getActiveUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const userId = await getActiveUserId();
  if (!userId) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const endpoint = String(body?.endpoint ?? "");
  const p256dh = String(body?.keys?.p256dh ?? "");
  const auth = String(body?.keys?.auth ?? "");
  if (!endpoint || !p256dh || !auth) return NextResponse.json({ ok: false, reason: "BAD_SUB" }, { status: 400 });

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId, endpoint, p256dh, auth },
    update: { userId, p256dh, auth },
  });
  return NextResponse.json({ ok: true });
}
