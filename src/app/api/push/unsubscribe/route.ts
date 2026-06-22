import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const endpoint = String(body?.endpoint ?? "");
  if (endpoint) {
    await prisma.pushSubscription.deleteMany({ where: { endpoint, userId } });
  }
  return NextResponse.json({ ok: true });
}
