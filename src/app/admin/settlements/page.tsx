import { Download } from "lucide-react";
import { listWithdrawals, computePayout, WITHHOLDING_RATE } from "@/server/payment/WithdrawalService";
import AdminWithdrawalActions from "@/components/admin/AdminWithdrawalActions";
import { decryptField } from "@/lib/fieldCrypto";

export const dynamic = "force-dynamic";

const won = (n: number) => n.toLocaleString();
function ymd(d: Date | string | null) {
  if (!d) return "-";
  const x = new Date(d);
  return `${x.getFullYear()}.${String(x.getMonth() + 1).padStart(2, "0")}.${String(x.getDate()).padStart(2, "0")}`;
}
function ym(d: Date | string | null) {
  const x = new Date(d ?? Date.now());
  return `${x.getFullYear()}년 ${String(x.getMonth() + 1).padStart(2, "0")}월`;
}

export default async function SettlementsPage() {
  const all = await listWithdrawals();
  const pending = all.filter((w) => w.status === "requested");
  const paid = all
    .filter((w) => w.status === "paid")
    .sort((a, b) => new Date(b.processedAt ?? 0).getTime() - new Date(a.processedAt ?? 0).getTime());

  const totalNet = paid.reduce((s, w) => s + w.amountWon, 0);
  const totalWithholding = paid.reduce((s, w) => s + computePayout(w.amountWon).withholdingWon, 0);
  const totalPayout = totalNet - totalWithholding;

  // 월별 그룹
  const months = new Map<string, typeof paid>();
  for (const w of paid) {
    const key = ym(w.processedAt);
    if (!months.has(key)) months.set(key, []);
    months.get(key)!.push(w);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-ink">정산 관리</h1>
        <a
          href="/admin/settlements/export"
          className="flex items-center gap-1.5 rounded-xl bg-ink px-3 py-2 text-[13px] font-bold text-white"
        >
          <Download size={15} /> CSV 내려받기
        </a>
      </div>

      {/* 요약 */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SummaryCard label="처리 대기" value={`${pending.length}건`} accent />
        <SummaryCard label="누적 정산액" value={`${won(totalNet)}원`} />
        <SummaryCard label="누적 원천징수(3.3%)" value={`${won(totalWithholding)}원`} />
        <SummaryCard label="누적 실지급액" value={`${won(totalPayout)}원`} />
      </div>

      {/* 처리 대기 */}
      <section className="mt-7">
        <h2 className="mb-2 text-sm font-extrabold text-ink">처리 대기 ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="rounded-2xl bg-white p-5 text-center text-sm text-stone-400">대기 중인 출금 신청이 없어요.</p>
        ) : (
          <div className="space-y-2.5">
            {pending.map((w) => {
              const { withholdingWon, payoutWon } = computePayout(w.amountWon);
              return (
                <div key={w.id} className="rounded-2xl border border-amber-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-ink">{w.accountHolder} <span className="font-normal text-stone-400">({w.seller.nickname})</span></div>
                      <div className="text-[12px] text-stone-400">{w.seller.email}</div>
                      <div className="mt-1 text-[13px] font-semibold text-ink">
                        {w.bankName} {decryptField(w.accountNumber)}
                      </div>
                    </div>
                    <AdminWithdrawalActions id={w.id} />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-stone-50 p-2.5 text-center text-[12px]">
                    <div><div className="text-stone-400">정산액</div><div className="font-bold text-ink">{won(w.amountWon)}원</div></div>
                    <div><div className="text-stone-400">원천징수 3.3%</div><div className="font-bold text-coral-dark">-{won(withholdingWon)}원</div></div>
                    <div><div className="text-stone-400">실지급액</div><div className="font-extrabold text-forest">{won(payoutWon)}원</div></div>
                  </div>
                  <div className="mt-1.5 text-[11px] text-stone-400">{ymd(w.requestedAt)} 신청</div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 지급 완료 — 월별 */}
      <section className="mt-7">
        <h2 className="mb-2 text-sm font-extrabold text-ink">지급 완료 내역 (월별)</h2>
        {paid.length === 0 ? (
          <p className="rounded-2xl bg-white p-5 text-center text-sm text-stone-400">아직 지급 완료된 내역이 없어요.</p>
        ) : (
          [...months.entries()].map(([month, rows]) => {
            const mNet = rows.reduce((s, w) => s + w.amountWon, 0);
            const mWh = rows.reduce((s, w) => s + computePayout(w.amountWon).withholdingWon, 0);
            return (
              <div key={month} className="mb-4 overflow-hidden rounded-2xl border border-stone-200 bg-white">
                <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50 px-4 py-2.5">
                  <span className="text-sm font-extrabold text-ink">{month}</span>
                  <span className="text-[12px] text-ink-muted">
                    정산 {won(mNet)}원 · 원천징수 {won(mWh)}원 · 실지급 {won(mNet - mWh)}원
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-[12px]">
                    <thead className="bg-stone-50/60 text-stone-400">
                      <tr className="text-left">
                        <th className="px-3 py-2 font-semibold">지급일</th>
                        <th className="px-3 py-2 font-semibold">예금주/아이디</th>
                        <th className="px-3 py-2 font-semibold">계좌</th>
                        <th className="px-3 py-2 text-right font-semibold">정산액</th>
                        <th className="px-3 py-2 text-right font-semibold">원천징수</th>
                        <th className="px-3 py-2 text-right font-semibold">실지급</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((w) => {
                        const { withholdingWon, payoutWon } = computePayout(w.amountWon);
                        return (
                          <tr key={w.id} className="border-t border-stone-100">
                            <td className="whitespace-nowrap px-3 py-2 text-stone-500">{ymd(w.processedAt)}</td>
                            <td className="px-3 py-2">
                              <div className="font-bold text-ink">{w.accountHolder}</div>
                              <div className="text-[11px] text-stone-400">{w.seller.email}</div>
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-stone-600">{w.bankName} {decryptField(w.accountNumber)}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-right font-semibold text-ink">{won(w.amountWon)}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-right text-coral-dark">-{won(withholdingWon)}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-right font-extrabold text-forest">{won(payoutWon)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        )}
      </section>

      <p className="mt-2 text-[11px] leading-relaxed text-stone-400">
        ※ 원천징수 {(WITHHOLDING_RATE * 100).toFixed(1)}%는 개인 판매자(사업소득) 기준이에요. 실제 세무 신고는 세무사와 확인하세요.
        CSV를 받아 제출 자료로 쓰면 편해요.
      </p>
    </div>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-3.5 ${accent ? "border-amber-200 bg-amber-50" : "border-stone-200 bg-white"}`}>
      <div className="text-base font-extrabold tabular-nums text-ink">{value}</div>
      <div className="mt-0.5 text-[11px] text-stone-400">{label}</div>
    </div>
  );
}
