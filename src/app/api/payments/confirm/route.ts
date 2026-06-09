import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { confirmPurchase } from "@/server/payment/PaymentService";

const MESSAGE: Record<string, string> = {
  NOT_PAID: "결제가 완료되지 않았어요.",
  AMOUNT_MISMATCH: "결제 금액이 맞지 않아요.",
  NOT_FOR_SALE: "판매 중인 지도가 아니에요.",
  OWNER: "내 지도는 구매할 수 없어요.",
  BUYER_MISMATCH: "결제 정보가 일치하지 않아요.",
  BAD_CUSTOMDATA: "결제 정보를 확인할 수 없어요.",
  CURRENCY: "통화 정보가 올바르지 않아요.",
};

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const paymentId = String(body.paymentId ?? "");
  if (!paymentId) return NextResponse.json({ ok: false, reason: "NO_PAYMENT_ID" }, { status: 400 });

  try {
    const r = await confirmPurchase(paymentId, userId);
    if (!r.ok) {
      return NextResponse.json({ ok: false, reason: r.reason, message: MESSAGE[r.reason ?? ""] ?? "결제 확인에 실패했어요." }, { status: 400 });
    }
    return NextResponse.json({ ok: true, collectionId: r.collectionId });
  } catch (e) {
    console.error("[payments/confirm]", e);
    return NextResponse.json({ ok: false, reason: "SERVER", message: "결제 확인 중 오류가 났어요. 결제됐다면 잠시 후 자동 반영돼요." }, { status: 500 });
  }
}
