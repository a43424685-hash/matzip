import { NextResponse } from "next/server";
import { getActiveUserId } from "@/lib/auth";
import { toggleVisit } from "@/server/collection/CollectionService";

export async function POST(req: Request) {
  const userId = await getActiveUserId();
  if (!userId) return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const r = await toggleVisit(
    userId,
    String(body.collectionId ?? ""),
    String(body.restaurantId ?? ""),
    !!body.visited
  );
  if (!r.ok) {
    const status = r.reason === "NO_ACCESS" ? 403 : 400;
    return NextResponse.json({ ok: false, reason: r.reason }, { status });
  }
  return NextResponse.json({ ok: true, visited: r.visited });
}
