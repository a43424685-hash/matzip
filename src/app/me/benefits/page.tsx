import { redirect } from "next/navigation";
import { Megaphone, Utensils, Ticket, Map } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import MeSubPageHeader from "@/components/MeSubPageHeader";

export const dynamic = "force-dynamic";

const BENEFITS = [
  { icon: Megaphone, title: "정직 리뷰 캠페인", desc: "솔직 리뷰를 쓰고 혜택 받기" },
  { icon: Utensils, title: "무료 식사권", desc: "가게가 제공하는 식사권" },
  { icon: Ticket, title: "쿠폰", desc: "할인·증정 쿠폰" },
  { icon: Map, title: "유료 맛집지도 맛보기", desc: "프리미엄 지도 미리보기" },
];

export default async function BenefitsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <main className="px-5 pb-24 pt-5">
      <MeSubPageHeader title="혜택 모음" />
      <div className="space-y-3">
        {BENEFITS.map((b) => (
          <div key={b.title} className="flex items-center gap-3 rounded-2xl border border-stone-200 p-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-forest-soft text-forest">
              <b.icon size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-ink">{b.title}</div>
              <div className="truncate text-[12px] text-stone-400">{b.desc}</div>
            </div>
            <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-bold text-stone-500">
              준비중
            </span>
          </div>
        ))}
      </div>
    </main>
  );
}
