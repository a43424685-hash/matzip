import { BadgePercent, Lock, ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getBlockedIds } from "@/server/block/BlockService";
import { prisma } from "@/lib/db";
import { getActiveRegions } from "@/server/catalog";
import {
  getOverallUserRankingCached,
  getRegionUserRankingCached,
  getMyOverallRank,
} from "@/server/ranking/RankingService";
import BackHomeHeader from "@/components/BackHomeHeader";
import RankingClient from "@/components/RankingClient";

export const dynamic = "force-dynamic";

interface CreatorEligibility {
  level: number;
  verifiedCount: number;
  publicCollections: number;
  bestRegionVerified: number;
  openReports: number;
  eligible: boolean;
}

export default async function RankingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; regionId?: string }>;
}) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  const regions = await getActiveRegions();
  const regionId = sp.regionId || regions[0]?.id || "";
  const safeTab = sp.tab === "region" ? "region" : "overall";
  const [myRank, eligibility, initialOverall, initialRegion] = await Promise.all([
    user ? getMyOverallRank(user.id) : Promise.resolve(0),
    user ? getCreatorEligibility(user.id) : Promise.resolve(null),
    getOverallUserRankingCached(),
    regionId ? getRegionUserRankingCached(regionId) : Promise.resolve([]),
  ]);

  // 차단한 사용자는 랭킹에서 제외 (캐시는 전역, 표시 시 뷰어별 필터)
  const blocked = user ? new Set(await getBlockedIds(user.id)) : new Set<string>();
  const overall = blocked.size > 0 ? initialOverall.filter((r) => !blocked.has(r.userId)) : initialOverall;
  const region = blocked.size > 0 ? initialRegion.filter((r) => !blocked.has(r.userId)) : initialRegion;

  return (
    <main className="px-5 py-6">
      <BackHomeHeader title="랭킹" />
      <p className="mb-4 text-[13px] text-ink-muted">
        랭킹이 오르면 노출, 혜택, 유료 맛집 지도 자격이 열립니다.
      </p>

      {user && <MyRankCard user={user} rank={myRank} eligibility={eligibility} />}

      <section className="mt-5 rounded-2xl bg-ink px-5 py-5 text-white">
        <div className="flex items-center gap-2 text-sm font-extrabold">
          <BadgePercent size={18} className="text-coral" />
          랭킹 혜택
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <BenefitMini title="지역 TOP 50" body="캠페인 신청" />
          <BenefitMini title="월간 TOP 10" body="우선권" />
          <BenefitMini title="Lv.20+" body="유료지도 도전" />
        </div>
      </section>

      <CreatorMapCard eligibility={eligibility} />

      <RankingClient
        initialTab={safeTab}
        userId={user?.id ?? null}
        regions={regions}
        initialRegionId={sp.regionId || regionId}
        initialOverall={overall}
        initialRegion={region}
      />
    </main>
  );
}

async function getCreatorEligibility(userId: string): Promise<CreatorEligibility> {
  const [user, verifiedPosts, publicCollections, openReports] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { totalLevel: true } }),
    prisma.restaurantPost.findMany({
      where: { userId, locationVerified: true },
      select: { restaurant: { select: { primaryRegionId: true } } },
    }),
    prisma.collection.count({ where: { userId, isPublic: true } }),
    countOpenReportsAgainstUser(userId),
  ]);

  const byRegion = new Map<string, number>();
  for (const p of verifiedPosts) {
    const rid = p.restaurant.primaryRegionId;
    byRegion.set(rid, (byRegion.get(rid) ?? 0) + 1);
  }
  const bestRegionVerified = Math.max(0, ...Array.from(byRegion.values()));
  const verifiedCount = verifiedPosts.length;
  const eligible =
    (user?.totalLevel ?? 1) >= 50 &&
    verifiedCount >= 100 &&
    publicCollections >= 3 &&
    bestRegionVerified >= 30 &&
    openReports === 0;

  return {
    level: user?.totalLevel ?? 1,
    verifiedCount,
    publicCollections,
    bestRegionVerified,
    openReports,
    eligible,
  };
}

async function countOpenReportsAgainstUser(userId: string): Promise<number> {
  const [posts, comments] = await Promise.all([
    prisma.restaurantPost.findMany({ where: { userId }, select: { id: true } }),
    prisma.comment.findMany({ where: { userId }, select: { id: true } }),
  ]);
  const postIds = posts.map((p) => p.id);
  const commentIds = comments.map((c) => c.id);
  if (postIds.length === 0 && commentIds.length === 0) return 0;
  return prisma.report.count({
    where: {
      status: "open",
      OR: [
        postIds.length ? { targetType: "post", targetId: { in: postIds } } : undefined,
        commentIds.length ? { targetType: "comment", targetId: { in: commentIds } } : undefined,
      ].filter((v): v is NonNullable<typeof v> => !!v),
    },
  });
}

function MyRankCard({
  user,
  rank,
  eligibility,
}: {
  user: { totalLevel: number; totalXp: number; nickname: string };
  rank: number;
  eligibility: CreatorEligibility | null;
}) {
  const top50Left = rank > 50 ? `${rank - 50}명` : "달성";
  const levelLeft = Math.max(0, 20 - user.totalLevel);
  const verifiedLeft = Math.max(0, 30 - (eligibility?.verifiedCount ?? 0));

  return (
    <section className="rounded-2xl bg-forest px-5 py-5 text-white">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[12px] font-bold text-white/70">내 현재 랭킹</p>
          <div className="mt-1 text-3xl font-black tabular-nums">
            {rank > 0 ? `#${rank}` : "순위권 밖"}
          </div>
        </div>
        <div className="rounded-2xl bg-white/12 px-4 py-3 text-right">
          <p className="text-[12px] text-white/70">{user.nickname}</p>
          <p className="text-xl font-black">Lv.{user.totalLevel}</p>
          <p className="text-[11px] tabular-nums text-white/60">{user.totalXp.toLocaleString()} XP</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <ProgressMini label="TOP 50까지" value={top50Left} />
        <ProgressMini label="Lv.20까지" value={levelLeft === 0 ? "달성" : `${levelLeft}Lv`} />
        <ProgressMini label="인증 30곳까지" value={verifiedLeft === 0 ? "달성" : `${verifiedLeft}곳`} />
      </div>
    </section>
  );
}

function BenefitMini({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl bg-white/10 px-2 py-3">
      <div className="text-[12px] font-extrabold">{title}</div>
      <div className="mt-0.5 text-[11px] text-white/65">{body}</div>
    </div>
  );
}

function ProgressMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/10 px-2 py-3">
      <div className="text-[11px] text-white/65">{label}</div>
      <div className="mt-0.5 text-sm font-black">{value}</div>
    </div>
  );
}

function CreatorMapCard({ eligibility }: { eligibility: CreatorEligibility | null }) {
  const checks = [
    { label: "Lv.20 이상", ok: (eligibility?.level ?? 1) >= 20, value: `Lv.${eligibility?.level ?? 1}/20` },
    { label: "위치 인증 맛집 30곳", ok: (eligibility?.verifiedCount ?? 0) >= 30, value: `${eligibility?.verifiedCount ?? 0}/30` },
    { label: "공개 리스트 3개", ok: (eligibility?.publicCollections ?? 0) >= 3, value: `${eligibility?.publicCollections ?? 0}/3` },
    { label: "한 지역 인증 30곳", ok: (eligibility?.bestRegionVerified ?? 0) >= 30, value: `${eligibility?.bestRegionVerified ?? 0}/30` },
    { label: "미해결 신고 0건", ok: (eligibility?.openReports ?? 0) === 0, value: `${eligibility?.openReports ?? 0}건` },
  ];

  return (
    <section className="mt-4 rounded-2xl border border-stone-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-forest-soft text-forest">
          {eligibility?.eligible ? <ShieldCheck size={22} /> : <Lock size={22} />}
        </span>
        <div>
          <h2 className="text-sm font-extrabold text-ink">유료 맛집 지도 판매 자격</h2>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">
            20곳은 무료 맛보기로 직접 선택, 나머지는 결제 후 공개됩니다.
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2">
        {checks.map((c) => (
          <div key={c.label} className="flex items-center justify-between rounded-xl bg-stone-50 px-3 py-2">
            <span className="text-[12px] font-semibold text-ink">{c.label}</span>
            <span className={`text-[12px] font-extrabold ${c.ok ? "text-forest" : "text-stone-400"}`}>{c.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
