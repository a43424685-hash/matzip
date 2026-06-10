import Link from "next/link";
import { Banknote, RotateCcw, ShieldAlert, ChevronRight } from "lucide-react";
import { getPayoutSummary } from "@/server/payment/WithdrawalService";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const s = await getPayoutSummary();

  return (
    <div>
      <h1 className="text-xl font-black text-ink">관리자 홈</h1>

      {s.requestedCount > 0 && (
        <Link
          href="/admin/settlements"
          className="mt-4 flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 p-4"
        >
          <div>
            <div className="text-sm font-extrabold text-ink">정산 처리 대기 {s.requestedCount}건</div>
            <div className="mt-0.5 text-[12px] text-ink-muted">{s.requestedWon.toLocaleString()}원 출금 신청이 기다리고 있어요</div>
          </div>
          <ChevronRight size={18} className="text-amber-500" />
        </Link>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <div className="text-lg font-extrabold tabular-nums text-ink">{s.paidWon.toLocaleString()}원</div>
          <div className="mt-0.5 text-[11px] text-stone-400">누적 지급(정산액)</div>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <div className="text-lg font-extrabold tabular-nums text-ink">{s.paidCount}건</div>
          <div className="mt-0.5 text-[11px] text-stone-400">총 지급 횟수</div>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        <MenuCard href="/admin/settlements" icon={<Banknote size={18} />} title="정산 관리" desc="출금 신청 처리 · 원천징수 · 월별 내역 · CSV" />
        <MenuCard href="/admin/refunds" icon={<RotateCcw size={18} />} title="환불 관리" desc="결제 취소 · 접근 회수 · 정산 조정" />
        <MenuCard href="/admin/reports" icon={<ShieldAlert size={18} />} title="신고 · 문의" desc="신고된 글/사용자 · 고객 문의" />
      </div>
    </div>
  );
}

function MenuCard({ href, icon, title, desc }: { href: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-4">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest-soft/50 text-forest">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold text-ink">{title}</div>
        <div className="text-[12px] text-ink-muted">{desc}</div>
      </div>
      <ChevronRight size={18} className="text-stone-300" />
    </Link>
  );
}
