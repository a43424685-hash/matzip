import { NextResponse } from "next/server";
import { confirmPurchase } from "@/server/payment/PaymentService";
import { verifyPortOneWebhook } from "@/lib/portone";

/**
 * 포트원 웹훅 — 사용자가 결제 직후 브라우저를 닫아 confirm 호출이 누락돼도
 * 결제 완료를 받아 구매를 확정(멱등). 결제 진위는 PaymentService 가 PortOne API 로 재확인.
 * 먼저 서명을 검증(Standard Webhooks)하고, 통과한 요청만 처리한다.
 */
export async function POST(req: Request) {
  // 서명 검증은 '원본 텍스트' 기준 — JSON 파싱 전에 raw body로 검증
  const rawBody = await req.text();
  const verified = verifyPortOneWebhook(rawBody, req.headers);
  if (!verified.ok) {
    console.error("[payments/webhook] 서명 검증 실패:", verified.reason);
    return NextResponse.json({ ok: false, reason: verified.reason }, { status: 401 });
  }

  let body: { type?: string; data?: { paymentId?: string }; paymentId?: string } | null = null;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: true });
  }
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
