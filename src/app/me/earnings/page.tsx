import Link from "next/link";
import { redirect } from "next/navigation";
import { Coins, Map as MapIcon, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getSellerEarnings } from "@/server/payment/PaymentService";
import { getSellerBalance, listMyWithdrawals, MIN_WITHDRAW_WON } from "@/server/payment/WithdrawalService";
import MeSubPageHeader from "@/components/MeSubPageHeader";
import WithdrawForm from "@/components/WithdrawForm";
import { decryptField, maskAccountNumber } from "@/lib/fieldCrypto";
import { SETTLEMENT_NOTICE } from "@/lib/iapTiers";

export const dynamic = "force-dynamic";

const WD_STATUS: Record<string, { label: string; cls: string }> = {
  requested: { label: "처리 중", cls: "bg-amber-100 text-amber-700" },
  paid: { label: "지급완료", cls: "bg-forest-soft text-forest" },
  rejected: { label: "반려", cls: "bg-stone-100 text-stone-500" },
};

function fmtDate(d: Date | string) {
  const x = new Date(d);
  return `${x.getFullYear()}.${String(x.getMonth() + 1).padStart(2, "0")}.${String(x.getDate()).padStart(2, "0")}`;
}

export default async function EarningsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [e, balance, withdrawals, acc] = await Promise.all([
    getSellerEarnings(user.id),
    getSellerBalance(user.id),
    listMyWithdrawals(user.id),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { bankName: true, accountNumber: true, accountHolder: true },
    }),
  ]);
  const account =
    acc?.bankName && acc.accountNumber && acc.accountHolder
      ? {
          bankName: acc.bankName,
          accountNumber: maskAccountNumber(decryptField(acc.accountNumber)), // 마스킹 표시
          accountHolder: acc.accountHolder,
        }
      : null;

  return (
    <main className="px-5 pb-24 pt-5">
      <MeSubPageHeader title="판매자 센터" />

      {/* 정산 요약 */}
      <div className="rounded-2xl bg-forest p-5 text-white">
        <div className="text-[13px] text-white/75">출금 가능 잔액</div>
        <div className="mt-1 text-3xl font-black tabular-nums">{balance.availableWon.toLocaleString()}원</div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-white/80">
          <span>누적 정산액 {balance.totalNetWon.toLocaleString()}원</span>
          {balance.holdWon > 0 && <span>정산 대기 {balance.holdWon.toLocaleString()}원</span>}
          <span>지급완료 {balance.withdrawnWon.toLocaleString()}원</span>
          {balance.pendingWon > 0 && <span>신청 중 {balance.pendingWon.toLocaleString()}원</span>}
        </div>
        {balance.holdWon > 0 && (
          <p className="mt-2 text-[11px] leading-relaxed text-white/60">
            판매 후 14일 동안은 스토어 환불 가능성 때문에 정산 대기 상태예요. 기간이 지나면 자동으로 출금 가능 잔액에 더해져요.
          </p>
        )}
      </div>

      {/* 유료지도 관리 — 판매 켜기/끄기·가격 (센터에서 바로 접근) */}
      <Link
        href="/me/paid-map"
        className="mt-3 flex items-center gap-3 rounded-2xl border border-forest/20 bg-white p-4 active:scale-[0.99]"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest-soft text-forest">
          <MapIcon size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-extrabold text-ink">유료지도 관리</div>
          <div className="text-[12px] text-ink-muted">판매 켜기·끄기 · 가격 조정</div>
        </div>
        <ChevronRight size={18} className="text-stone-300" />
      </Link>

      {/* 출금 신청 */}
      <WithdrawForm
        availableWon={balance.availableWon}
        minWon={MIN_WITHDRAW_WON}
        canWithdraw={balance.canWithdraw}
        hasPending={balance.hasPending}
        account={account}
      />

      {/* 출금 내역 */}
      {withdrawals.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-extrabold text-ink">출금 내역</h2>
          <div className="space-y-2">
            {withdrawals.map((w) => {
              const s = WD_STATUS[w.status] ?? WD_STATUS.requested;
              return (
                <div key={w.id} className="card flex items-center justify-between p-3.5">
                  <div>
                    <div className="text-sm font-bold text-ink">{w.amountWon.toLocaleString()}원</div>
                    <div className="mt-0.5 text-[11px] text-stone-400">
                      {fmtDate(w.requestedAt)} 신청
                      {w.processedAt && ` · ${fmtDate(w.processedAt)} 처리`}
                    </div>
                  </div>
                  <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${s.cls}`}>{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 판매 통계 */}
      <div className="mt-6 grid grid-cols-3 gap-2 text-center">
        {[
          { label: "총 판매", v: `${e.salesCount}건` },
          { label: "총 판매액", v: `${e.totalGrossWon.toLocaleString()}원` },
          { label: "수수료 합계", v: `${e.totalFeeWon.toLocaleString()}원` },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-stone-200 p-3">
            <div className="text-[15px] font-extrabold tabular-nums text-ink">{s.v}</div>
            <div className="mt-0.5 text-[11px] text-stone-400">{s.label}</div>
          </div>
        ))}
      </div>

      {/* 지도별 수익 */}
      {e.perMap.length === 0 ? (
        <p className="mt-6 rounded-2xl bg-stone-50 p-5 text-center text-sm text-ink-muted">
          아직 판매 수익이 없어요.
          <br />
          내 유료 맛집 지도가 팔리면 이곳에 수익이 쌓여요.
        </p>
      ) : (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-extrabold text-ink">지도별 수익</h2>
          <div className="space-y-2">
            {e.perMap.map((m) => (
              <div key={m.collectionId} className="card flex items-center gap-3 p-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-forest-soft/40 text-forest">
                  <Coins size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-ink">{m.title}</div>
                  <div className="mt-0.5 text-[12px] text-ink-muted">{m.count}건 판매</div>
                </div>
                <div className="shrink-0 text-right text-sm font-black text-forest">
                  {m.netWon.toLocaleString()}원
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-4 px-1 text-[12px] leading-relaxed text-ink-muted">
        ※ {SETTLEMENT_NOTICE} 출금 신청 시 운영자가 확인 후 등록하신 계좌로 입금해드려요.
      </p>
    </main>
  );
}
