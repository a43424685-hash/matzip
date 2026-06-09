import { NextResponse } from "next/server";
import { confirmPurchase } from "@/server/payment/PaymentService";

/**
 * 포트원 웹훅 — 사용자가 결제 직후 브라우저를 닫아 confirm 호출이 누락돼도
 * 결제 완료를 받아 구매를 확정(멱등). 결제 진위는 PaymentService 가 PortOne API 로 재확인.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  // V2 웹훅: { type, data: { paymentId, ... } }
  const paymentId: string | undefined = body?.data?.paymentId ?? body?.paymentId;
  const type: string | undefined = body?.type;

  if (!paymentId) return NextResponse.json({ ok: true }); // 처리할 게 없음 — 200 으로 응답
  // 결제 완료/거래 관련 이벤트만 처리
  if (type && !/Paid|paid|Transaction\.Paid|PAID/.test(type)) {
    return NextResponse.json({ ok: true });
  }

  try {
    await confirmPurchase(paymentId);
  } catch (e) {
    console.error("[payments/webhook]", e);
    // 200 외 응답이면 포트원이 재시도하므로, 일시 오류는 500 으로 재시도 유도
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
