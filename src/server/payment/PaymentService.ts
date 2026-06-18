/**
 * PaymentService — 유료 맛집 지도 결제(포트원 V2).
 *  prepare: 결제 시작 전 주문 정보(paymentId·금액) 생성 — 금액은 항상 서버 DB에서 산출.
 *  confirm: 결제 후 서버가 PortOne API로 실제 결제를 검증하고 MapPurchase 생성(구매 확정).
 */
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { getPortOnePayment, cancelPortOnePayment } from "@/lib/portone";

export const PAID_MAP_FEE_RATE = 0.3; // 플랫폼 수수료 30%

export interface PrepareResult {
  ok: boolean;
  reason?: string;
  paymentId?: string;
  orderName?: string;
  amount?: number;
}

/** 결제 시작 — 주문번호·금액 발급 (금액은 DB priceWon 기준, 클라이언트 입력 무시) */
export async function preparePurchase(userId: string, collectionId: string): Promise<PrepareResult> {
  const col = await prisma.collection.findUnique({
    where: { id: collectionId },
    select: { id: true, title: true, isPaid: true, priceWon: true, userId: true },
  });
  if (!col) return { ok: false, reason: "NOT_FOUND" };
  if (!col.isPaid || !col.priceWon) return { ok: false, reason: "NOT_FOR_SALE" };
  if (col.userId === userId) return { ok: false, reason: "OWNER" };

  const existing = await prisma.mapPurchase.findUnique({
    where: { buyerId_collectionId: { buyerId: userId, collectionId } },
    select: { status: true },
  });
  if (existing?.status === "paid") return { ok: false, reason: "ALREADY" }; // 환불(refunded)이면 재구매 허용

  const paymentId = `mz_${randomUUID()}`;
  // 주문 정보를 서버에 저장 — confirm/webhook은 이 값을 신뢰(클라 customData 위변조 방지)
  await prisma.paymentIntent.create({
    data: { paymentId, buyerId: userId, collectionId, amountWon: col.priceWon, status: "ready" },
  });
  return {
    ok: true,
    paymentId,
    orderName: `먹고핀 맛집지도 - ${col.title}`,
    amount: col.priceWon,
  };
}

export interface ConfirmResult {
  ok: boolean;
  reason?: string;
  collectionId?: string;
}

/**
 * 결제 검증 + 구매 확정. confirm 라우트(세션)와 webhook(무세션) 양쪽에서 사용.
 * paymentId 로 PortOne 실제 결제를 조회해 상태·금액·통화를 확인하고 MapPurchase 생성.
 * expectBuyerId 가 주어지면 customData 의 구매자와 일치해야 함.
 */
export async function confirmPurchase(
  paymentId: string,
  expectBuyerId?: string
): Promise<ConfirmResult> {
  // 구매자·컬렉션·금액은 prepare 때 서버가 저장한 주문(PaymentIntent)을 신뢰한다.
  const intent = await prisma.paymentIntent.findUnique({ where: { paymentId } });
  if (!intent) return { ok: false, reason: "NO_INTENT" };
  const collectionId = intent.collectionId;
  const buyerId = intent.buyerId;
  if (expectBuyerId && expectBuyerId !== buyerId) return { ok: false, reason: "BUYER_MISMATCH" };

  const payment = await getPortOnePayment(paymentId);
  if (payment.status !== "PAID") return { ok: false, reason: "NOT_PAID" };

  const col = await prisma.collection.findUnique({
    where: { id: collectionId },
    select: { isPaid: true, priceWon: true, userId: true },
  });
  if (!col || !col.isPaid || !col.priceWon) return { ok: false, reason: "NOT_FOR_SALE" };
  if (col.userId === buyerId) return { ok: false, reason: "OWNER" };

  // 금액·통화 검증 (위변조 방지) — PG 실결제액 = 주문 저장액 = 현재 가격 모두 일치해야 함
  const paidTotal = payment.amount?.total;
  if (paidTotal !== intent.amountWon || paidTotal !== col.priceWon) {
    return { ok: false, reason: "AMOUNT_MISMATCH" };
  }
  if (payment.currency && payment.currency !== "KRW") return { ok: false, reason: "CURRENCY" };

  const amountWon = col.priceWon;
  const feeWon = Math.round(amountWon * PAID_MAP_FEE_RATE);
  const sellerNetWon = amountWon - feeWon;
  const provider = payment.channel?.pgProvider || payment.method?.provider || null;

  // 멱등 + 환불 후 재구매 대응 (buyerId×collectionId 유니크라 upsert)
  await prisma.mapPurchase.upsert({
    where: { buyerId_collectionId: { buyerId, collectionId } },
    create: {
      buyerId,
      collectionId,
      amountWon,
      feeWon,
      sellerNetWon,
      status: "paid",
      provider,
      paymentKey: paymentId,
      orderId: paymentId,
    },
    update: {
      amountWon,
      feeWon,
      sellerNetWon,
      status: "paid",
      provider,
      paymentKey: paymentId,
      orderId: paymentId,
      paidAt: new Date(),
    },
  });

  await prisma.paymentIntent
    .update({ where: { paymentId }, data: { status: "paid", paidAt: new Date() } })
    .catch(() => {});

  return { ok: true, collectionId };
}

// ─────────────────────────────────────────────────────────────
// 구매 내역 / 판매 정산 조회
// ─────────────────────────────────────────────────────────────

/** 내가 구매한 유료 지도 목록 */
export async function getMyPurchases(buyerId: string) {
  const rows = await prisma.mapPurchase.findMany({
    where: { buyerId, status: "paid" },
    orderBy: { paidAt: "desc" },
    select: {
      amountWon: true,
      paidAt: true,
      collection: {
        select: {
          id: true,
          title: true,
          region: { select: { name: true } },
          user: { select: { nickname: true } },
          _count: { select: { items: true } },
        },
      },
    },
  });
  return rows.map((r) => ({
    collectionId: r.collection.id,
    title: r.collection.title,
    regionName: r.collection.region.name,
    sellerNickname: r.collection.user.nickname,
    itemCount: r.collection._count.items,
    amountWon: r.amountWon,
    paidAt: r.paidAt,
  }));
}

/** 관리자 환불용 — 최근 결제(구매) 목록 */
export async function listRecentPurchases(limit = 100) {
  const rows = await prisma.mapPurchase.findMany({
    orderBy: { paidAt: "desc" },
    take: limit,
    select: {
      id: true,
      amountWon: true,
      status: true,
      paidAt: true,
      orderId: true,
      buyer: { select: { nickname: true, email: true } },
      collection: { select: { id: true, title: true, user: { select: { nickname: true } } } },
    },
  });
  return rows;
}

/** 관리자: 환불 처리 — 포트원 결제취소 + 구매 상태 refunded (정산은 status="paid"만 집계되어 자동 차감) */
export async function refundPurchase(purchaseId: string): Promise<{ ok: boolean; reason?: string }> {
  const p = await prisma.mapPurchase.findUnique({
    where: { id: purchaseId },
    select: { id: true, status: true, orderId: true, paymentKey: true, collection: { select: { title: true } } },
  });
  if (!p) return { ok: false, reason: "NOT_FOUND" };
  if (p.status !== "paid") return { ok: false, reason: "NOT_REFUNDABLE" };

  const paymentId = p.orderId || p.paymentKey;
  if (!paymentId) return { ok: false, reason: "NO_PAYMENT_ID" };

  try {
    await cancelPortOnePayment(paymentId, `환불: ${p.collection.title}`);
  } catch (e) {
    console.error("[refund] PortOne 취소 실패", e);
    return { ok: false, reason: "PG_CANCEL_FAILED" };
  }

  await prisma.mapPurchase.update({ where: { id: purchaseId }, data: { status: "refunded" } });
  return { ok: true };
}

export interface SellerEarnings {
  totalGrossWon: number; // 총 판매액
  totalFeeWon: number; // 총 수수료(30%)
  totalNetWon: number; // 총 정산액(70%)
  salesCount: number; // 판매 건수
  perMap: { collectionId: string; title: string; count: number; netWon: number }[];
}

/** 내가 판매한 유료 지도의 수익(정산) 요약 */
export async function getSellerEarnings(sellerId: string): Promise<SellerEarnings> {
  const rows = await prisma.mapPurchase.findMany({
    where: { status: "paid", collection: { userId: sellerId } },
    select: {
      amountWon: true,
      feeWon: true,
      sellerNetWon: true,
      collectionId: true,
      collection: { select: { title: true } },
    },
  });

  let totalGrossWon = 0;
  let totalFeeWon = 0;
  let totalNetWon = 0;
  const map = new Map<string, { title: string; count: number; netWon: number }>();
  for (const r of rows) {
    totalGrossWon += r.amountWon;
    totalFeeWon += r.feeWon;
    totalNetWon += r.sellerNetWon;
    const cur = map.get(r.collectionId) ?? { title: r.collection.title, count: 0, netWon: 0 };
    cur.count += 1;
    cur.netWon += r.sellerNetWon;
    map.set(r.collectionId, cur);
  }
  const perMap = [...map.entries()]
    .map(([collectionId, v]) => ({ collectionId, ...v }))
    .sort((a, b) => b.netWon - a.netWon);

  return { totalGrossWon, totalFeeWon, totalNetWon, salesCount: rows.length, perMap };
}
