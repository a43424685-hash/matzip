import { redirect } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import MeSubPageHeader from "@/components/MeSubPageHeader";

export const dynamic = "force-dynamic";

const NOTICES = [
  {
    title: "먹고핀 베타 서비스 안내",
    body: "먹고핀은 현재 베타 서비스 중이에요. 위치 인증 기반의 진짜 맛집 기록을 함께 만들어가요. 이용 중 불편한 점은 고객센터로 알려주세요.",
  },
  {
    title: "정직 리뷰 캠페인 운영 원칙",
    body: "좋은 리뷰를 강요하지 않습니다. 방문자는 실제 경험을 솔직하게 작성해야 하며, 거짓 리뷰·허위 인증이 확인되면 계정이 제한될 수 있어요.",
  },
  {
    title: "유료 맛집지도 출시 예정 안내",
    body: "Lv.20과 위치 인증 맛집 30곳을 달성하면 나만의 유료 맛집지도를 열 수 있어요. 판매·정산 기능은 순차적으로 공개될 예정이에요.",
  },
];

export default async function NoticesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <main className="px-5 pb-24 pt-5">
      <MeSubPageHeader title="공지사항" />
      <div className="space-y-2">
        {NOTICES.map((n) => (
          <details key={n.title} className="rounded-2xl border border-stone-200">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3.5 text-sm font-bold text-ink">
              {n.title}
              <ChevronDown size={16} className="text-stone-400" />
            </summary>
            <p className="px-4 pb-4 text-[13px] leading-relaxed text-ink-muted">{n.body}</p>
          </details>
        ))}
      </div>
    </main>
  );
}
