/**
 * WithdrawalService — 판매 수익 출금(정산 지급).
 * 앱은 장부 역할: 판매자가 출금 신청 → 운영자가 실제 계좌이체 후 '지급완료' 처리하면 잔액 차감.
 */
import { prisma } from "@/lib/db";
import { getSellerEarnings } from "@/server/payment/PaymentService";

export const MIN_WITHDRAW_WON = 100_000; // 출금 최소 금액
export const WITHHOLDING_RATE = 0.033; // 사업소득 원천징수 3.3% (개인 판매자 가정)

/** 정산액(소득)에서 원천징수·실지급액 계산 */
export function computePayout(amountWon: number) {
  const withholdingWon = Math.floor(amountWon * WITHHOLDING_RATE);
  return { withholdingWon, payoutWon: amountWon - withholdingWon };
}

export interface SellerBalance {
  totalNetWon: number; // 누적 정산액
  holdWon: number; // 정산 홀드(14일) 중 — 아직 출금 불가
  withdrawnWon: number; // 지급완료된 합계
  pendingWon: number; // 신청 중(미지급) 합계
  availableWon: number; // 지금 출금 가능 잔액 (홀드 지난 정산액 기준)
  canWithdraw: boolean; // 최소금액 이상 + 진행 중 신청 없음
  hasPending: boolean;
}

export async function getSellerBalance(sellerId: string): Promise<SellerBalance> {
  const [earnings, withdrawals] = await Promise.all([
    getSellerEarnings(sellerId),
    prisma.withdrawal.findMany({
      where: { sellerId, status: { in: ["requested", "paid"] } },
      select: { amountWon: true, status: true },
    }),
  ]);
  let withdrawnWon = 0;
  let pendingWon = 0;
  for (const w of withdrawals) {
    if (w.status === "paid") withdrawnWon += w.amountWon;
    else pendingWon += w.amountWon;
  }
  // 출금 가능액은 '홀드가 지난 정산액'만 인정 — 판매 직후 출금해버리면
  // 이후 스토어 환불 때 플랫폼이 현금 손해를 보는 걸 막는다.
  const availableWon = Math.max(0, earnings.settledNetWon - withdrawnWon - pendingWon);
  const hasPending = pendingWon > 0;
  return {
    totalNetWon: earnings.totalNetWon,
    holdWon: earnings.holdWon,
    withdrawnWon,
    pendingWon,
    availableWon,
    hasPending,
    canWithdraw: availableWon >= MIN_WITHDRAW_WON && !hasPending,
  };
}

export async function requestWithdrawal(
  sellerId: string
): Promise<{ ok: boolean; reason?: string }> {
  // 계좌는 클라이언트가 아니라 서버에 등록된 값을 스냅샷한다(위·변조 방지).
  // accountNumber 는 암호문 그대로 복사 저장 — 운영자 정산 화면에서 복호화해 사용.
  const user = await prisma.user.findUnique({
    where: { id: sellerId },
    select: { bankName: true, accountNumber: true, accountHolder: true },
  });
  const bankName = user?.bankName?.trim();
  const accountNumber = user?.accountNumber?.trim();
  const accountHolder = user?.accountHolder?.trim();
  if (!bankName || !accountNumber || !accountHolder) return { ok: false, reason: "BANK_REQUIRED" };

  // 셀러 단위 잠금으로 동시 신청 레이스(이중 신청→이중 지급) 차단
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${sellerId}))`;
    const bal = await getSellerBalance(sellerId);
    if (bal.hasPending) return { ok: false, reason: "PENDING_EXISTS" };
    if (bal.availableWon < MIN_WITHDRAW_WON) return { ok: false, reason: "BELOW_MIN" };

    await tx.withdrawal.create({
      data: { sellerId, amountWon: bal.availableWon, bankName, accountNumber, accountHolder },
    });
    return { ok: true };
  });
}

export async function listMyWithdrawals(sellerId: string) {
  return prisma.withdrawal.findMany({
    where: { sellerId },
    orderBy: { requestedAt: "desc" },
    select: { id: true, amountWon: true, status: true, requestedAt: true, processedAt: true },
  });
}

// ── 운영자(정산 담당) ──────────────────────────────────────────

export async function listWithdrawals(status?: string) {
  return prisma.withdrawal.findMany({
    where: status ? { status } : undefined,
    orderBy: [{ status: "asc" }, { requestedAt: "asc" }],
    select: {
      id: true,
      amountWon: true,
      status: true,
      bankName: true,
      accountNumber: true,
      accountHolder: true,
      requestedAt: true,
      processedAt: true,
      seller: { select: { nickname: true, email: true } },
    },
  });
}

export async function getPayoutSummary() {
  const rows = await prisma.withdrawal.groupBy({
    by: ["status"],
    _sum: { amountWon: true },
    _count: { _all: true },
  });
  const get = (s: string) => rows.find((r) => r.status === s);
  return {
    requestedWon: get("requested")?._sum.amountWon ?? 0,
    requestedCount: get("requested")?._count._all ?? 0,
    paidWon: get("paid")?._sum.amountWon ?? 0,
    paidCount: get("paid")?._count._all ?? 0,
  };
}

/** 운영자: 출금 신청 처리 (지급완료/반려) */
export async function processWithdrawal(
  id: string,
  action: "paid" | "reject",
  memo?: string
): Promise<{ ok: boolean; reason?: string }> {
  // 원자적 처리 — 운영자 2명이 동시에 눌러도 한 번만 처리된다
  const updated = await prisma.withdrawal.updateMany({
    where: { id, status: "requested" },
    data: {
      status: action === "paid" ? "paid" : "rejected",
      processedAt: new Date(),
      memo: memo?.trim() || null,
    },
  });
  if (updated.count === 0) {
    const exists = await prisma.withdrawal.findUnique({ where: { id }, select: { id: true } });
    return { ok: false, reason: exists ? "ALREADY_PROCESSED" : "NOT_FOUND" };
  }
  return { ok: true };
}
