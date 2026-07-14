import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { setPaidMap } from "@/server/collection/CollectionService";

const MESSAGE: Record<string, string> = {
  NOT_FOUND: "리스트를 찾을 수 없어요.",
  FORBIDDEN: "내 리스트만 설정할 수 있어요.",
  NOT_ELIGIBLE: "판매 자격(Lv.20·위치 인증 30곳)을 아직 못 채웠어요.",
  EMPTY: "맛집이 1곳 이상 담긴 리스트만 판매할 수 있어요.",
  NEED_VERIFIED: "유료 지도엔 내가 위치 인증한 맛집만 담을 수 있어요. 미인증 맛집을 빼주세요.",
  NEED_PREVIEW: "맛보기(무료 공개) 가게를 5곳 이상 먼저 지정해주세요.",
  BAD_PRICE: "가격은 정해진 5개 티어(2,900·4,900·9,900·14,900·19,900원) 중에서만 선택할 수 있어요.",
};

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const r = await setPaidMap(
    userId,
    String(body.collectionId ?? ""),
    !!body.isPaid,
    body.priceWon != null ? Number(body.priceWon) : null,
    body.forSale !== false // 기본 true(판매). false면 비공개 초안 잠금(자격 불필요).
  );
  if (!r.ok) {
    const status = r.reason === "FORBIDDEN" ? 403 : r.reason === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ ok: false, reason: r.reason, message: MESSAGE[r.reason ?? ""] }, { status });
  }
  return NextResponse.json({ ok: true });
}
