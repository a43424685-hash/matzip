import { redirect } from "next/navigation";
import { Map, Check } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import MeSubPageHeader from "@/components/MeSubPageHeader";

export const dynamic = "force-dynamic";

const LEVEL_GOAL = 50;
const VERIFY_GOAL = 100;
const FREE_PUBLIC_GOAL = 20; // 무료 공개 맛집 (향후)

function Progress({ label, now, goal, pct }: { label: string; now: string; goal: string; pct: number }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-[13px]">
        <span className="font-semibold text-ink">{label}</span>
        <span className="tabular-nums text-ink-muted">
          <b className="text-forest">{now}</b> / {goal}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-stone-100">
        <div className="h-full rounded-full bg-forest" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default async function PaidMapPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const verifiedCount = await prisma.restaurantPost.count({
    where: { userId: user.id, locationVerified: true },
  });
  const levelPct = Math.min(100, Math.round((user.totalLevel / LEVEL_GOAL) * 100));
  const verifyPct = Math.min(100, Math.round((verifiedCount / VERIFY_GOAL) * 100));
  const unlocked = user.totalLevel >= LEVEL_GOAL && verifiedCount >= VERIFY_GOAL;

  return (
    <main className="px-5 pb-24 pt-5">
      <MeSubPageHeader title="유료 맛집지도 관리" />

      <section className="rounded-2xl border border-forest/20 bg-forest-soft/30 p-5">
        <div className="flex items-center gap-1.5">
          <Map size={17} className="text-forest" />
          <h2 className="text-[15px] font-extrabold text-ink">오픈 조건</h2>
        </div>
        <div className="mt-4 space-y-3.5">
          <Progress label="레벨" now={`Lv.${user.totalLevel}`} goal={`Lv.${LEVEL_GOAL}`} pct={levelPct} />
          <Progress label="위치 인증 맛집" now={`${verifiedCount}`} goal={`${VERIFY_GOAL}곳`} pct={verifyPct} />
        </div>
      </section>

      {unlocked ? (
        <div className="mt-5">
          <p className="flex items-center gap-1.5 text-sm font-bold text-forest">
            <Check size={16} /> 조건을 달성했어요!
          </p>
          <button
            type="button"
            className="mt-3 flex h-12 w-full items-center justify-center rounded-xl bg-forest text-sm font-bold text-white active:scale-[0.99]"
          >
            유료 맛집지도 만들기
          </button>
          <p className="mt-3 rounded-2xl bg-stone-50 p-4 text-[13px] text-ink-muted">
            지도를 만들 때 <b className="text-ink">무료 공개 맛집 {FREE_PUBLIC_GOAL}개</b>를 선택해 미리보기로
            제공하게 돼요. (판매·결제 기능은 곧 열려요)
          </p>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl bg-stone-50 p-5 text-center">
          <p className="text-sm font-bold text-ink">아직 유료 맛집지도를 열 수 없어요.</p>
          <p className="mt-1 text-[13px] text-ink-muted">
            Lv.{LEVEL_GOAL}과 위치 인증 맛집 {VERIFY_GOAL}곳을 달성해보세요.
          </p>
        </div>
      )}
    </main>
  );
}
