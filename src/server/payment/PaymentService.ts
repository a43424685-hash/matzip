/**
 * PaymentService — 유료 맛집 지도 결제 (인앱결제 / RevenueCat).
 *  prepare : 구매 가능 여부·구매차단 확인 + 결제할 스토어 상품 ID 반환(금액은 서버 DB 기준).
 *  confirm : 앱이 RevenueCat SDK로 결제한 뒤, 서버가 RevenueCat REST로 실제 구매를
 *            검증하고 MapPurchase 생성(구매 확정 = 지도 잠금 해제).
 *  refund  : RevenueCat 웹훅(스토어 환불)으로 접근 회수 + 상습 환불자 차단.
 */
import { prisma } from "@/lib/db";
import { verifyConsumable } from "@/lib/revenuecat";
import {
  computeSettlement,
  productIdForWon,
  wonForProductId,
  SETTLEMENT_HOLD_DAYS,
  REVEAL_REFUND_THRESHOLD,
  REFUND_BLOCK_COUNT,
} from "@/lib/iapTiers";

export interface PrepareResult {
  ok: boolean;
  reason?: string;
  productId?: string; // 스토어 상품 ID (map_unlock_9900)
  amount?: number;
  orderName?: string;
}

/** 구매 시작 — 구매차단 확인 + 결제할 상품 ID 반환 (금액·상품은 DB priceWon 기준) */
export async function preparePurchase(userId: string, collectionId: string): Promise<PrepareResult> {
  const [me, col] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { purchaseBlocked: true } }),
    prisma.collection.findUnique({
      where: { id: collectionId },
      select: { id: true, title: true, isPaid: true, isPublic: true, priceWon: true, userId: true },
    }),
  ]);
  if (me?.purchaseBlocked) return { ok: false, reason: "BLOCKED" }; // 상습 환불 → 구매 제한
  if (!col) return { ok: false, reason: "NOT_FOUND" };
  if (!col.isPaid || !col.isPublic || !col.priceWon) return { ok: false, reason: "NOT_FOR_SALE" };
  if (col.userId === userId) return { ok: false, reason: "OWNER" };

  const existing = await prisma.mapPurchase.findUnique({
    where: { buyerId_collectionId: { buyerId: userId, collectionId } },
    select: { status: true },
  });
  if (existing?.status === "paid") return { ok: false, reason: "ALREADY" };

  const productId = productIdForWon(col.priceWon);
  if (!productId) return { ok: false, reason: "BAD_PRICE" };
  return { ok: true, productId, amount: col.priceWon, orderName: `먹고핀 맛집지도 - ${col.title}` };
}

export interface ConfirmResult {
  ok: boolean;
  reason?: string;
  collectionId?: string;
}

/**
 * 결제 검증 + 구매 확정. 앱에서 RevenueCat 결제 성공 후 호출.
 * 서버가 collection 가격 → 상품ID를 산출하고, RevenueCat에 그 상품의 구매가 있는지 확인한다.
 * (transactionId는 환불 매칭 키로 저장. 스토어별 ID 포맷 차이는 RevenueCat이 흡수)
 */
export async function confirmPurchase(
  userId: string,
  collectionId: string,
  transactionId: string | undefined,
  platform: string | undefined,
): Promise<ConfirmResult> {
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { purchaseBlocked: true } });
  if (me?.purchaseBlocked) return { ok: false, reason: "BLOCKED" };

  const col = await prisma.collection.findUnique({
    where: { id: collectionId },
    select: { isPaid: true, priceWon: true, userId: true },
  });
  if (!col || !col.isPaid || !col.priceWon) return { ok: false, reason: "NOT_FOR_SALE" };
  if (col.userId === userId) return { ok: false, reason: "OWNER" };

  const productId = productIdForWon(col.priceWon);
  if (!productId) return { ok: false, reason: "BAD_PRICE" };

  // RevenueCat 검증 — 이 유저가 이 상품을 실제 구매했는가
  const verified = await verifyConsumable(userId, productId, transactionId).catch((e) => {
    console.error("[confirm] RevenueCat 검증 실패", e);
    return null;
  });
  if (!verified) return { ok: false, reason: "NOT_VERIFIED" };

  // 이 거래ID가 다른 지도에 이미 쓰였으면 거부(한 결제 = 한 지도)
  if (verified.storeTransactionId) {
    const dup = await prisma.mapPurchase.findFirst({
      where: { transactionId: verified.storeTransactionId, NOT: { collectionId } },
      select: { id: true },
    });
    if (dup) return { ok: false, reason: "TX_REUSED" };
  }

  const amountWon = col.priceWon;
  const s = computeSettlement(amountWon);
  const now = new Date();
  const settledAt = new Date(now.getTime() + SETTLEMENT_HOLD_DAYS * 86400_000); // 정산 홀드
  const refundableUntil = new Date(now.getTime() + 7 * 86400_000); // 단순변심 환불 창(열람 임계치로 조기 소멸)

  await prisma.mapPurchase.upsert({
    where: { buyerId_collectionId: { buyerId: userId, collectionId } },
    create: {
      buyerId: userId,
      collectionId,
      amountWon,
      feeWon: s.platformNetWon,
      sellerNetWon: s.sellerNetWon,
      storeFeeWon: s.storeFeeWon,
      status: "paid",
      platform: platform ?? verified.store ?? null,
      productId,
      transactionId: verified.storeTransactionId || null,
      revealCount: 0,
      refundableUntil,
      settledAt,
      paidAt: now,
    },
    update: {
      amountWon,
      feeWon: s.platformNetWon,
      sellerNetWon: s.sellerNetWon,
      storeFeeWon: s.storeFeeWon,
      status: "paid",
      platform: platform ?? verified.store ?? null,
      productId,
      transactionId: verified.storeTransactionId || null,
      revealCount: 0,
      refundedAt: null,
      refundableUntil,
      settledAt,
      paidAt: now,
    },
  });

  return { ok: true, collectionId };
}

// ─────────────────────────────────────────────────────────────
// 환불(스토어) 처리 — RevenueCat 웹훅에서 호출. 접근 회수 + 상습 환불 차단.
// ─────────────────────────────────────────────────────────────
export async function handleStoreRefund(params: {
  transactionId?: string;
  appUserId?: string;
  productId?: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const { transactionId, appUserId, productId } = params;

  // 1) 거래ID로 매칭 (우선)
  let purchase = transactionId
    ? await prisma.mapPurchase.findFirst({ where: { transactionId, status: "paid" }, select: { id: true, buyerId: true } })
    : null;

  // 2) 폴백: 유저 + 상품 가격의 가장 최근 'paid' 구매
  if (!purchase && appUserId && productId) {
    const won = wonForProductId(productId);
    purchase = await prisma.mapPurchase.findFirst({
      where: { buyerId: appUserId, status: "paid", ...(won ? { amountWon: won } : {}) },
      orderBy: { paidAt: "desc" },
      select: { id: true, buyerId: true },
    });
  }
  if (!purchase) return { ok: false, reason: "NO_MATCH" };

  await prisma.mapPurchase.update({
    where: { id: purchase.id },
    data: { status: "refunded", refundedAt: new Date() }, // status!=paid → 자동 재잠금
  });

  // 상습 환불자 차단
  const u = await prisma.user.update({
    where: { id: purchase.buyerId },
    data: { refundCount: { increment: 1 } },
    select: { refundCount: true },
  });
  if (u.refundCount >= REFUND_BLOCK_COUNT) {
    await prisma.user.update({ where: { id: purchase.buyerId }, data: { purchaseBlocked: true } });
  }
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// 열람 기록 — 맛보기 외 가게를 열면 카운트. 임계치 넘으면 단순변심 환불 창 소멸.
// ─────────────────────────────────────────────────────────────
export async function recordReveal(
  userId: string,
  collectionId: string,
  restaurantId: string,
): Promise<{ ok: boolean; revealCount: number; refundable: boolean }> {
  // 구매자만 (구매 안 했으면 무의미)
  const purchase = await prisma.mapPurchase.findUnique({
    where: { buyerId_collectionId: { buyerId: userId, collectionId } },
    select: { id: true, status: true },
  });
  if (!purchase || purchase.status !== "paid") return { ok: false, revealCount: 0, refundable: false };

  await prisma.mapItemReveal.upsert({
    where: { userId_collectionId_restaurantId: { userId, collectionId, restaurantId } },
    create: { userId, collectionId, restaurantId },
    update: {},
  });
  const revealCount = await prisma.mapItemReveal.count({ where: { userId, collectionId } });

  // 임계치 도달 → 소비 완료로 간주, 단순변심 환불 창 즉시 소멸
  const refundable = revealCount < REVEAL_REFUND_THRESHOLD;
  await prisma.mapPurchase.update({
    where: { id: purchase.id },
    data: { revealCount, ...(refundable ? {} : { refundableUntil: null }) },
  });
  return { ok: true, revealCount, refundable };
}

/** 이 유저가 이 지도에서 이미 열람한 가게 restaurantId 목록 */
export async function getRevealedIds(userId: string, collectionId: string): Promise<string[]> {
  const rows = await prisma.mapItemReveal.findMany({
    where: { userId, collectionId },
    select: { restaurantId: true },
  });
  return rows.map((r) => r.restaurantId);
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
      transactionId: true,
      buyer: { select: { nickname: true, email: true } },
      collection: { select: { id: true, title: true, user: { select: { nickname: true } } } },
    },
  });
  return rows;
}

/**
 * 관리자: 환불 처리 — 우리 DB만 refunded 로(접근 회수). 실제 스토어 환불은
 * 애플/구글이 처리하며, 그쪽 환불은 RevenueCat 웹훅으로 자동 반영된다.
 */
export async function refundPurchase(purchaseId: string): Promise<{ ok: boolean; reason?: string }> {
  const p = await prisma.mapPurchase.findUnique({
    where: { id: purchaseId },
    select: { id: true, status: true, buyerId: true },
  });
  if (!p) return { ok: false, reason: "NOT_FOUND" };
  if (p.status !== "paid") return { ok: false, reason: "NOT_REFUNDABLE" };

  await prisma.mapPurchase.update({ where: { id: purchaseId }, data: { status: "refunded", refundedAt: new Date() } });
  const u = await prisma.user.update({
    where: { id: p.buyerId },
    data: { refundCount: { increment: 1 } },
    select: { refundCount: true },
  });
  if (u.refundCount >= REFUND_BLOCK_COUNT) {
    await prisma.user.update({ where: { id: p.buyerId }, data: { purchaseBlocked: true } });
  }
  return { ok: true };
}

export interface SellerEarnings {
  totalGrossWon: number; // 총 판매액
  totalFeeWon: number; // 총 수수료(플랫폼+스토어)
  totalNetWon: number; // 총 정산액(셀러)
  salesCount: number;
  perMap: { collectionId: string; title: string; count: number; netWon: number }[];
}

/** 내가 판매한 유료 지도의 수익(정산) 요약 */
export async function getSellerEarnings(sellerId: string): Promise<SellerEarnings> {
  const rows = await prisma.mapPurchase.findMany({
    where: { status: "paid", collection: { userId: sellerId } },
    select: {
      amountWon: true,
      feeWon: true,
      storeFeeWon: true,
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
    totalFeeWon += r.feeWon + r.storeFeeWon;
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
