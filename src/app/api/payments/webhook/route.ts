import { NextResponse } from "next/server";
import { handleStoreRefund } from "@/server/payment/PaymentService";
import { verifyWebhookAuth, REFUND_EVENT_TYPES } from "@/lib/revenuecat";

/**
 * RevenueCat 웹훅 — 스토어(애플/구글) 환불·취소가 발생하면 알림이 온다.
 * 환불 이벤트면 해당 구매를 회수(status=refunded → 자동 재잠금) + 상습 환불자 차단.
 * 구매 확정은 앱이 /api/payments/confirm 으로 직접 하므로 여기선 환불만 처리.
 * 인증: RevenueCat 대시보드에서 지정한 Authorization 헤더로 검증.
 */
export async function POST(req: Request) {
  if (!verifyWebhookAuth(req.headers.get("authorization"))) {
    return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: {
    event?: {
      type?: string;
      app_user_id?: string;
      product_id?: string;
      transaction_id?: string;
      store_transaction_id?: string;
      id?: string;
    };
  } | null = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const ev = body?.event;
  if (!ev?.type) return NextResponse.json({ ok: true });
  if (!REFUND_EVENT_TYPES.has(ev.type)) return NextResponse.json({ ok: true }); // 환불/취소만 처리

  try {
    const result = await handleStoreRefund({
      transactionId: ev.store_transaction_id ?? ev.transaction_id ?? ev.id,
      appUserId: ev.app_user_id,
      productId: ev.product_id,
    });
    // 매칭 실패(NO_MATCH)를 200으로 삼키면 환불 회수가 영구 유실된다.
    // 5xx로 응답해 RevenueCat 재시도를 유도하고, 원문을 로깅해 수동 대사(reconciliation) 가능하게.
    if (!result.ok) {
      console.error("[revenuecat/webhook] 환불 매칭 실패 — 재시도 유도", {
        reason: result.reason,
        transactionId: ev.store_transaction_id ?? ev.transaction_id ?? ev.id,
        appUserId: ev.app_user_id,
        productId: ev.product_id,
        type: ev.type,
      });
      return NextResponse.json({ ok: false, reason: result.reason }, { status: 500 });
    }
  } catch (e) {
    console.error("[revenuecat/webhook]", e);
    return NextResponse.json({ ok: false }, { status: 500 }); // 재시도 유도
  }
  return NextResponse.json({ ok: true });
}
