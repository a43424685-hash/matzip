import { redirect } from "next/navigation";
import { Map, Check } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import MeSubPageHeader from "@/components/MeSubPageHeader";
import PaidMapManager from "@/components/PaidMapManager";

export const dynamic = "force-dynamic";

const LEVEL_GOAL = 20;
const VERIFY_GOAL = 30;
const PROOF_GOAL = 5; // 위 30곳 중 영수증/메뉴 인증 포함

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

  const [verifiedCount, proofCount, myCollections] = await Promise.all([
    prisma.restaurantPost.count({
      where: { userId: user.id, locationVerified: true },
    }),
    prisma.restaurantPost.count({
      where: { userId: user.id, locationVerified: true, OR: [{ receiptVerified: true }, { menuVerified: true }] },
    }),
    prisma.collection.findMany({
      where: { userId: user.id },
      orderBy: [{ isPaid: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        title: true,
        isPaid: true,
        isPublic: true,
        priceWon: true,
        _count: { select: { items: true, purchases: true } },
      },
    }),
  ]);
  const levelPct = Math.min(100, Math.round((user.totalLevel / LEVEL_GOAL) * 100));
  const verifyPct = Math.min(100, Math.round((verifiedCount / VERIFY_GOAL) * 100));
  // 운영자는 조건 없이 항상 열림 (유료 지도 오픈/운영용)
  // 자격 = 레벨 20 + 위치 인증 30곳 (영수증/메뉴 조건 제거 — 다른 화면과 통일)
  const unlocked =
    user.isAdmin || (user.totalLevel >= LEVEL_GOAL && verifiedCount >= VERIFY_GOAL);
  // 판매 후보 = 맛집이 1곳 이상 담긴 내 리스트 (여기 관리 허브에서 바로 켜고 끔)
  const candidates = myCollections
    .filter((c) => c._count.items > 0)
    .map((c) => ({
      id: c.id,
      title: c.title,
      isPaid: c.isPaid,
      isPublic: c.isPublic,
      priceWon: c.priceWon,
      itemCount: c._count.items,
      purchaseCount: c._count.purchases,
    }));

  return (
    <main className="px-5 pb-24 pt-5">
      <MeSubPageHeader title="유료 맛집지도 관리" />

      {user.isAdmin ? (
        <section className="flex items-center gap-2 rounded-2xl border border-forest/20 bg-forest-soft/30 p-5">
          <Map size={18} className="shrink-0 text-forest" />
          <p className="text-sm font-bold text-forest">운영자 계정은 조건 없이 유료 지도가 열려 있어요.</p>
        </section>
      ) : (
        <section className="rounded-2xl border border-forest/20 bg-forest-soft/30 p-5">
          <div className="flex items-center gap-1.5">
            <Map size={17} className="text-forest" />
            <h2 className="text-[15px] font-extrabold text-ink">오픈 조건</h2>
          </div>
          <div className="mt-4 space-y-3.5">
            <Progress label="레벨" now={`Lv.${user.totalLevel}`} goal={`Lv.${LEVEL_GOAL}`} pct={levelPct} />
            <Progress label="위치 인증 맛집" now={`${verifiedCount}`} goal={`${VERIFY_GOAL}곳`} pct={verifyPct} />
          </div>
          <p className="mt-2 text-[11px] text-stone-400">※ 레벨 20 + 위치 인증 맛집 30곳을 채우면 유료 지도를 열 수 있어요.</p>
        </section>
      )}

      {unlocked ? (
        <>
          <p className="mt-5 flex items-center gap-1.5 text-sm font-bold text-forest">
            <Check size={16} /> 판매 자격을 달성했어요!
          </p>
          <p className="mt-3 rounded-2xl bg-stone-50 p-4 text-[13px] text-ink-muted">
            아래에서 내 리스트를 <b className="text-ink">바로 유료로 켜고 끌 수</b> 있어요. 구매자는 가게 목록이
            가려진 채 지역·개수만 보고, 구매하면 전체가 열려요. <b className="text-ink">수수료 30%</b> 차감 후 정산돼요.
          </p>

          {/* 판매 관리 허브 — 모든 후보 리스트를 여기서 바로 켜고/끄고/가격 조정 */}
          <PaidMapManager collections={candidates} />
        </>
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
