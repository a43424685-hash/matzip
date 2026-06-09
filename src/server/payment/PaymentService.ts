/**
 * PaymentService — 유료 맛집 지도 결제(포트원 V2).
 *  prepare: 결제 시작 전 주문 정보(paymentId·금액) 생성 — 금액은 항상 서버 DB에서 산출.
 *  confirm: 결제 후 서버가 PortOne API로 실제 결제를 검증하고 MapPurchase 생성(구매 확정).
 */
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { getPortOnePayment } from "@/lib/portone";

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
    select: { id: true },
  });
  if (existing) return { ok: false, reason: "ALREADY" };

  const paymentId = `mz_${randomUUID()}`;
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
  const payment = await getPortOnePayment(paymentId);

  // customData 에서 구매자·컬렉션 식별
  let meta: { collectionId?: string; buyerId?: string } = {};
  try {
    meta = payment.customData ? JSON.parse(payment.customData) : {};
  } catch {
    return { ok: false, reason: "BAD_CUSTOMDATA" };
  }
  const collectionId = meta.collectionId;
  const buyerId = meta.buyerId;
  if (!collectionId || !buyerId) return { ok: false, reason: "BAD_CUSTOMDATA" };
  if (expectBuyerId && expectBuyerId !== buyerId) return { ok: false, reason: "BUYER_MISMATCH" };

  if (payment.status !== "PAID") return { ok: false, reason: "NOT_PAID" };

  const col = await prisma.collection.findUnique({
    where: { id: collectionId },
    select: { isPaid: true, priceWon: true, userId: true },
  });
  if (!col || !col.isPaid || !col.priceWon) return { ok: false, reason: "NOT_FOR_SALE" };
  if (col.userId === buyerId) return { ok: false, reason: "OWNER" };

  // 금액·통화 검증 (위변조 방지)
  const paidTotal = payment.amount?.total;
  if (paidTotal !== col.priceWon) return { ok: false, reason: "AMOUNT_MISMATCH" };
  if (payment.currency && payment.currency !== "KRW") return { ok: false, reason: "CURRENCY" };

  const amountWon = col.priceWon;
  const feeWon = Math.round(amountWon * PAID_MAP_FEE_RATE);
  const sellerNetWon = amountWon - feeWon;
  const provider = payment.channel?.pgProvider || payment.method?.provider || null;

  try {
    await prisma.mapPurchase.create({
      data: {
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
    });
  } catch (e: unknown) {
    // 이미 확정된 결제(중복 confirm/webhook) — 멱등 처리
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") {
      return { ok: true, collectionId };
    }
    throw e;
  }

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
