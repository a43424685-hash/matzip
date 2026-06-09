import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import MeSubPageHeader from "@/components/MeSubPageHeader";

export const dynamic = "force-dynamic";

export default async function EarningsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <main className="px-5 pb-24 pt-5">
      <MeSubPageHeader title="판매 수익 내역" />

      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: "이번 달 예상", v: "0원" },
          { label: "정산 가능", v: "0원" },
          { label: "총 판매 수", v: "0" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-stone-200 p-3.5">
            <div className="text-lg font-extrabold tabular-nums text-ink">{s.v}</div>
            <div className="mt-0.5 text-[11px] text-stone-400">{s.label}</div>
          </div>
        ))}
      </div>

      <p className="mt-6 rounded-2xl bg-stone-50 p-5 text-center text-sm text-ink-muted">
        아직 판매 수익이 없어요.
        <br />
        유료 맛집지도 판매가 시작되면 이곳에서 수익을 확인할 수 있어요.
      </p>

      <p className="mt-3 px-1 text-[12px] text-stone-400">
        ※ 판매 금액에서 결제·운영 수수료가 차감된 뒤 정산될 예정이에요.
      </p>
    </main>
  );
}
