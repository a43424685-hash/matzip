import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { preparePurchase } from "@/server/payment/PaymentService";

const MESSAGE: Record<string, string> = {
  NOT_FOUND: "리스트를 찾을 수 없어요.",
  NOT_FOR_SALE: "판매 중인 지도가 아니에요.",
  OWNER: "내 지도는 구매할 수 없어요.",
  ALREADY: "이미 구매한 지도예요.",
};

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const r = await preparePurchase(userId, String(body.collectionId ?? ""));
  if (!r.ok) {
    return NextResponse.json({ ok: false, reason: r.reason, message: MESSAGE[r.reason ?? ""] }, { status: 400 });
  }
  return NextResponse.json({ ok: true, paymentId: r.paymentId, orderName: r.orderName, amount: r.amount });
}
