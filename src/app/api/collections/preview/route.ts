import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { setItemPreview } from "@/server/collection/CollectionService";

const MESSAGE: Record<string, string> = {
  NOT_FOUND: "리스트를 찾을 수 없어요.",
  FORBIDDEN: "내 리스트만 설정할 수 있어요.",
};

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const r = await setItemPreview(
    userId,
    String(body.collectionId ?? ""),
    String(body.restaurantId ?? ""),
    !!body.isPreview
  );
  if (!r.ok) {
    const status = r.reason === "FORBIDDEN" ? 403 : r.reason === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ ok: false, reason: r.reason, message: MESSAGE[r.reason ?? ""] }, { status });
  }
  return NextResponse.json({ ok: true, previewCount: r.previewCount });
}
