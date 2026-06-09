import { redirect } from "next/navigation";
import { Coins } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getSellerEarnings } from "@/server/payment/PaymentService";
import MeSubPageHeader from "@/components/MeSubPageHeader";

export const dynamic = "force-dynamic";

export default async function EarningsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const e = await getSellerEarnings(user.id);

  return (
    <main className="px-5 pb-24 pt-5">
      <MeSubPageHeader title="판매 수익 내역" />

      {/* 정산 요약 */}
      <div className="rounded-2xl bg-forest p-5 text-white">
        <div className="text-[13px] text-white/75">정산 예정 금액 (수수료 30% 차감 후)</div>
        <div className="mt-1 text-3xl font-black tabular-nums">{e.totalNetWon.toLocaleString()}원</div>
        <div className="mt-3 flex gap-4 text-[12px] text-white/80">
          <span>총 판매 {e.salesCount}건</span>
          <span>총 판매액 {e.totalGrossWon.toLocaleString()}원</span>
          <span>수수료 {e.totalFeeWon.toLocaleString()}원</span>
        </div>
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

      <p className="mt-4 px-1 text-[12px] leading-relaxed text-stone-400">
        ※ 판매액에서 결제·운영 수수료 30%가 차감된 금액이 정산돼요. 실제 정산 지급 기능은 준비 중이에요.
      </p>
    </main>
  );
}
