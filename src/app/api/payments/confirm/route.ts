import { NextResponse } from "next/server";
import { getActiveUserId } from "@/lib/auth";
import { confirmPurchase } from "@/server/payment/PaymentService";

const MESSAGE: Record<string, string> = {
  NOT_VERIFIED: "결제가 확인되지 않았어요. 결제됐다면 잠시 후 다시 시도해 주세요.",
  NOT_FOR_SALE: "판매 중인 지도가 아니에요.",
  OWNER: "내 지도는 구매할 수 없어요.",
  BLOCKED: "반복 환불로 구매가 제한된 계정이에요.",
  BAD_PRICE: "판매 가격 정보가 올바르지 않아요.",
  TX_REUSED: "이 결제는 다른 지도에 이미 사용됐어요.",
};

export async function POST(req: Request) {
  const userId = await getActiveUserId();
  if (!userId) return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const collectionId = String(body.collectionId ?? "");
  if (!collectionId) return NextResponse.json({ ok: false, reason: "NO_COLLECTION" }, { status: 400 });
  const transactionId = body.transactionId ? String(body.transactionId) : undefined;
  const platform = body.platform ? String(body.platform) : undefined;

  try {
    const r = await confirmPurchase(userId, collectionId, transactionId, platform);
    if (!r.ok) {
      return NextResponse.json(
        { ok: false, reason: r.reason, message: MESSAGE[r.reason ?? ""] ?? "결제 확인에 실패했어요." },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true, collectionId: r.collectionId });
  } catch (e) {
    console.error("[payments/confirm]", e);
    return NextResponse.json(
      { ok: false, reason: "SERVER", message: "결제 확인 중 오류가 났어요. 결제됐다면 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
  }
}
