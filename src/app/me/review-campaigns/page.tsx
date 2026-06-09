import { redirect } from "next/navigation";
import { Megaphone } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import MeSubPageHeader from "@/components/MeSubPageHeader";

export const dynamic = "force-dynamic";

export default async function ReviewCampaignsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <main className="px-5 pb-24 pt-5">
      <MeSubPageHeader title="정직 리뷰 캠페인" />

      <div className="flex items-center gap-2 rounded-2xl bg-forest-soft/40 p-4">
        <Megaphone size={18} className="text-forest" />
        <p className="text-[13px] font-semibold text-ink">
          가게가 식사권·혜택을 제공하고, 방문자는 솔직 리뷰를 남기는 캠페인이에요.
        </p>
      </div>

      <div className="mt-4 rounded-2xl border border-stone-200 p-4 text-[13px] leading-relaxed text-ink-muted">
        <p className="font-bold text-ink">운영 원칙</p>
        <p className="mt-1.5">· 좋은 리뷰를 강요하지 않습니다.</p>
        <p>· 방문자는 실제 경험을 솔직하게 작성해야 합니다.</p>
        <p>· 거짓 리뷰나 허위 인증이 확인되면 계정이 제한될 수 있습니다.</p>
      </div>

      <p className="mt-6 rounded-2xl bg-stone-50 py-12 text-center text-sm text-stone-400">
        아직 진행 중인 캠페인이 없어요.
      </p>
    </main>
  );
}
