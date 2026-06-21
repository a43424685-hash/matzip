import BackHomeHeader from "@/components/BackHomeHeader";
import { Trophy, Megaphone, TicketPercent } from "lucide-react";

export const dynamic = "force-dynamic";

const BENEFITS = [
  { icon: Trophy, title: "랭킹 혜택", desc: "상위 랭커에게 체험권·캠페인 우선권을 드릴 예정이에요." },
  { icon: Megaphone, title: "정직 리뷰 캠페인", desc: "가게가 혜택을 주고, 방문자가 솔직 리뷰를 남기는 캠페인이에요." },
  { icon: TicketPercent, title: "사장님 쿠폰", desc: "가게가 등록한 할인·서비스 쿠폰을 받을 수 있어요." },
];

// 사장님 센터(혜택/쿠폰 등록)가 붙으면 각 카드에 실제 데이터를 연결한다. 지금은 '준비 중'.
export default function BenefitsPage() {
  return (
    <main className="px-5 py-6">
      <BackHomeHeader title="혜택 모음" />
      <p className="mb-4 text-[13px] text-ink-muted">먹고핀에서 받을 수 있는 혜택이에요. 순차적으로 열려요.</p>
      <div className="space-y-2.5">
        {BENEFITS.map((b) => {
          const Icon = b.icon;
          return (
            <div key={b.title} className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-forest-soft text-forest">
                <Icon size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-[15px] font-extrabold text-ink">{b.title}</h2>
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-400">준비 중</span>
                </div>
                <p className="mt-0.5 text-[13px] leading-relaxed text-ink-muted">{b.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
