import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { setPaidMap } from "@/server/collection/CollectionService";

const MESSAGE: Record<string, string> = {
  NOT_FOUND: "리스트를 찾을 수 없어요.",
  FORBIDDEN: "내 리스트만 설정할 수 있어요.",
  NOT_ELIGIBLE: "판매 자격(Lv.50·위치 인증 100곳)을 아직 못 채웠어요.",
  EMPTY: "맛집이 1곳 이상 담긴 리스트만 판매할 수 있어요.",
  BAD_PRICE: "가격은 990~9,900원 사이여야 해요.",
};

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const r = await setPaidMap(
    userId,
    String(body.collectionId ?? ""),
    !!body.isPaid,
    body.priceWon != null ? Number(body.priceWon) : null
  );
  if (!r.ok) {
    const status = r.reason === "FORBIDDEN" ? 403 : r.reason === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ ok: false, reason: r.reason, message: MESSAGE[r.reason ?? ""] }, { status });
  }
  return NextResponse.json({ ok: true });
}
