import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { setItemNote } from "@/server/collection/CollectionService";

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const r = await setItemNote(
    userId,
    String(body.collectionId ?? ""),
    String(body.restaurantId ?? ""),
    String(body.note ?? "")
  );
  if (!r.ok) {
    const status = r.reason === "FORBIDDEN" ? 403 : r.reason === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ ok: false, reason: r.reason }, { status });
  }
  return NextResponse.json({ ok: true });
}
