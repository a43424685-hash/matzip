import Link from "next/link";
import { redirect } from "next/navigation";
import { Map, Check, Coins, ChevronRight } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import MeSubPageHeader from "@/components/MeSubPageHeader";

export const dynamic = "force-dynamic";

const LEVEL_GOAL = 20;
const VERIFY_GOAL = 30;

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

  const [verifiedCount, myCollections] = await Promise.all([
    prisma.restaurantPost.count({
      where: { userId: user.id, locationVerified: true },
    }),
    prisma.collection.findMany({
      where: { userId: user.id },
      orderBy: [{ isPaid: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        title: true,
        isPaid: true,
        priceWon: true,
        _count: { select: { items: true, purchases: true } },
      },
    }),
  ]);
  const levelPct = Math.min(100, Math.round((user.totalLevel / LEVEL_GOAL) * 100));
  const verifyPct = Math.min(100, Math.round((verifiedCount / VERIFY_GOAL) * 100));
  // 운영자는 조건 없이 항상 열림 (유료 지도 오픈/운영용)
  const unlocked = user.isAdmin || (user.totalLevel >= LEVEL_GOAL && verifiedCount >= VERIFY_GOAL);
  const paidMaps = myCollections.filter((c) => c.isPaid);

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
        </section>
      )}

      {unlocked ? (
        <>
          <p className="mt-5 flex items-center gap-1.5 text-sm font-bold text-forest">
            <Check size={16} /> 판매 자격을 달성했어요!
          </p>
          <p className="mt-3 rounded-2xl bg-stone-50 p-4 text-[13px] text-ink-muted">
            내 맛집 리스트를 골라 <b className="text-ink">유료로 판매</b>할 수 있어요. 리스트 상세 페이지에서{" "}
            <b className="text-forest">유료 지도로 판매</b>를 켜고 가격(990~9,900원)을 정하면 돼요. 구매자는 가게 목록이
            가려진 채 지역·개수만 보고, 구매하면 전체가 열려요. <b className="text-ink">수수료 30%</b> 차감 후 정산돼요.
          </p>

          {/* 판매 중인 지도 */}
          {paidMaps.length > 0 && (
            <section className="mt-5">
              <h2 className="mb-2 flex items-center gap-1.5 text-sm font-extrabold text-ink">
                <Coins size={15} className="text-forest" /> 판매 중인 지도 {paidMaps.length}개
              </h2>
              <div className="space-y-2">
                {paidMaps.map((c) => (
                  <Link
                    key={c.id}
                    href={`/collections/${c.id}`}
                    className="card flex items-center gap-3 p-3.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold text-ink">{c.title}</div>
                      <div className="mt-0.5 text-[12px] text-ink-muted">
                        {c.priceWon?.toLocaleString()}원 · 맛집 {c._count.items}곳 · 구매 {c._count.purchases}건
                      </div>
                    </div>
                    <ChevronRight size={18} className="shrink-0 text-stone-300" />
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* 내 리스트로 이동 */}
          <Link
            href="/me/collections"
            className="mt-4 flex h-12 w-full items-center justify-center gap-1.5 rounded-xl border border-forest/30 bg-forest-soft/30 text-sm font-bold text-forest active:scale-[0.99]"
          >
            <Map size={16} /> 내 맛집 리스트에서 판매 설정하기
          </Link>
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
