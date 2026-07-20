import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { handleStoreRefund } from "@/server/payment/PaymentService";
import { verifyWebhookAuth, REFUND_EVENT_TYPES } from "@/lib/revenuecat";

/**
 * RevenueCat 웹훅 — 스토어(애플/구글) 환불·취소가 발생하면 알림이 온다.
 * 환불 이벤트면 해당 구매를 회수(status=refunded → 자동 재잠금) + 상습 환불자 차단.
 *
 * 유실 방지: event.id를 WebhookEvent(inbox)에 먼저 저장해 멱등 처리하고,
 * 매칭 실패건은 no_match 로 남겨 나중에 대사(reconciliation)로 회수한다.
 * (RevenueCat 재시도는 5회 후 종료되므로 DB 보관이 최종 안전망)
 */
export async function POST(req: Request) {
  if (!verifyWebhookAuth(req.headers.get("authorization"))) {
    return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: {
    event?: {
      id?: string;
      type?: string;
      app_user_id?: string;
      product_id?: string;
      transaction_id?: string;
      store_transaction_id?: string;
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

  const txId = ev.store_transaction_id ?? ev.transaction_id ?? ev.id;
  const eventId = ev.id ?? txId; // event.id 우선, 없으면 거래ID로 대체

  // 1) inbox에 접수 기록 (멱등 키 = eventId). 이미 처리된 이벤트면 재시도여도 조용히 200.
  if (eventId) {
    const existing = await prisma.webhookEvent
      .findUnique({ where: { eventId }, select: { status: true } })
      .catch(() => null);
    if (existing?.status === "processed" || existing?.status === "ignored") {
      return NextResponse.json({ ok: true, idempotent: true });
    }
    await prisma.webhookEvent
      .upsert({
        where: { eventId },
        create: {
          eventId,
          type: ev.type,
          status: "received",
          appUserId: ev.app_user_id ?? null,
          productId: ev.product_id ?? null,
          transactionId: txId ?? null,
        },
        update: {}, // 이미 있으면 그대로 (received/no_match 유지 → 재처리 시도)
      })
      .catch((e) => console.error("[revenuecat/webhook] inbox 저장 실패", e));
  }

  // 2) 실제 환불 회수 시도
  try {
    const result = await handleStoreRefund({
      transactionId: txId,
      appUserId: ev.app_user_id,
      productId: ev.product_id,
    });

    if (eventId) {
      await prisma.webhookEvent
        .update({
          where: { eventId },
          data: result.ok
            ? { status: "processed", processedAt: new Date() }
            : { status: "no_match" },
        })
        .catch(() => {});
    }

    if (!result.ok) {
      // 매칭 실패 — inbox에 no_match로 보관됨(대사 대상). RevenueCat 재시도도 유도.
      console.error("[revenuecat/webhook] 환불 매칭 실패 — inbox 보관 + 재시도 유도", {
        reason: result.reason,
        eventId,
        transactionId: txId,
        appUserId: ev.app_user_id,
        productId: ev.product_id,
        type: ev.type,
      });
      return NextResponse.json({ ok: false, reason: result.reason }, { status: 500 });
    }
  } catch (e) {
    console.error("[revenuecat/webhook]", e);
    return NextResponse.json({ ok: false }, { status: 500 }); // 재시도 유도 (inbox엔 received로 남음)
  }
  return NextResponse.json({ ok: true });
}
