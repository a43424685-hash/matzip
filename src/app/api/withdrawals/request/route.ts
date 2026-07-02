import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { requestWithdrawal } from "@/server/payment/WithdrawalService";

const MESSAGE: Record<string, string> = {
  BANK_REQUIRED: "정산 계좌를 먼저 등록해 주세요.",
  PENDING_EXISTS: "이미 처리 중인 출금 신청이 있어요.",
  BELOW_MIN: "출금 가능 잔액이 최소 금액(10만원)에 못 미쳐요.",
};

export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  const r = await requestWithdrawal(userId);
  if (!r.ok) {
    return NextResponse.json({ ok: false, reason: r.reason, message: MESSAGE[r.reason ?? ""] }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
