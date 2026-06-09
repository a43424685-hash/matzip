import { BadgePercent, Crown, Lock, Medal, ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveRegions } from "@/server/catalog";
import {
  getOverallUserRankingCached,
  getRegionUserRankingCached,
  getWeeklyRestaurantRankingCached,
  getMyOverallRank,
  type RestaurantRankRow,
  type UserRankRow,
} from "@/server/ranking/RankingService";
import BackHomeHeader from "@/components/BackHomeHeader";
import RankingControls from "@/components/RankingControls";

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
  const tab = sp.tab ?? "overall";
  const user = await getCurrentUser();
  const regions = await getActiveRegions();
  const regionId = sp.regionId || regions[0]?.id || "";
  const [myRank, eligibility] = user
    ? await Promise.all([getMyOverallRank(user.id), getCreatorEligibility(user.id)])
    : [0, null] as const;

  return (
    <main className="px-5 py-6">
      <BackHomeHeader title="랭킹" />
      <p className="mb-4 text-[13px] text-ink-muted">
        랭킹이 오르면 노출, 혜택, 유료 맛집 지도 자격이 열립니다.
      </p>

      {user && <MyRankCard user={user} rank={myRank} eligibility={eligibility} />}

      <section className="mt-5 rounded-3xl bg-ink px-5 py-5 text-white">
        <div className="flex items-center gap-2 text-sm font-extrabold">
          <BadgePercent size={18} className="text-coral" />
          랭킹 혜택
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <BenefitMini title="지역 TOP 50" body="캠페인 신청" />
          <BenefitMini title="월간 TOP 10" body="우선권" />
          <BenefitMini title="Lv.50+" body="유료지도 도전" />
        </div>
      </section>

      <CreatorMapCard eligibility={eligibility} />

      <RankingControls activeTab={tab} regionId={sp.regionId || regionId} regions={regions} />

      {tab === "overall" && <OverallTab userId={user?.id ?? null} />}
      {tab === "region" && <RegionTab regionId={regionId} />}
      {tab === "weekly" && <WeeklyTab regionId={sp.regionId || null} />}
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
  const levelLeft = Math.max(0, 50 - user.totalLevel);
  const verifiedLeft = Math.max(0, 100 - (eligibility?.verifiedCount ?? 0));

  return (
    <section className="rounded-3xl bg-forest px-5 py-5 text-white">
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
        <ProgressMini label="Lv.50까지" value={levelLeft === 0 ? "달성" : `${levelLeft}Lv`} />
        <ProgressMini label="인증 100곳까지" value={verifiedLeft === 0 ? "달성" : `${verifiedLeft}곳`} />
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
    { label: "Lv.50 이상", ok: (eligibility?.level ?? 1) >= 50, value: `Lv.${eligibility?.level ?? 1}/50` },
    { label: "위치 인증 맛집 100곳", ok: (eligibility?.verifiedCount ?? 0) >= 100, value: `${eligibility?.verifiedCount ?? 0}/100` },
    { label: "공개 리스트 3개", ok: (eligibility?.publicCollections ?? 0) >= 3, value: `${eligibility?.publicCollections ?? 0}/3` },
    { label: "한 지역 인증 30곳", ok: (eligibility?.bestRegionVerified ?? 0) >= 30, value: `${eligibility?.bestRegionVerified ?? 0}/30` },
    { label: "미해결 신고 0건", ok: (eligibility?.openReports ?? 0) === 0, value: `${eligibility?.openReports ?? 0}건` },
  ];

  return (
    <section className="mt-4 rounded-3xl border border-stone-200 bg-white p-4">
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

function RankBadge({ rank }: { rank: number }) {
  const cls =
    rank === 1
      ? "bg-coral text-white"
      : rank <= 3
        ? "bg-forest-soft text-forest"
        : "bg-stone-100 text-stone-500";
  return <span className={`badge-rank ${cls}`}>{rank}</span>;
}

function UserRow({ row, highlight }: { row: UserRankRow; highlight?: boolean }) {
  return (
    <li className={`flex items-center gap-3 p-3.5 ${highlight ? "bg-forest-soft" : "bg-white"}`}>
      <RankBadge rank={row.rank} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold text-ink">{row.nickname}</div>
        <div className="text-[11px] tabular-nums text-stone-400">
          {row.xp.toLocaleString()} XP · 최근 30일 {row.recent30dXp.toLocaleString()} XP
        </div>
      </div>
      <span className="badge-lv !px-2 !py-1 !text-xs">Lv.{row.level}</span>
    </li>
  );
}

async function OverallTab({ userId }: { userId: string | null }) {
  const rows = await getOverallUserRankingCached();
  return <RankList rows={rows} userId={userId} emptyText="아직 랭킹이 없어요. 첫 맛집을 등록해보세요." />;
}

async function RegionTab({ regionId }: { regionId: string }) {
  const rows = await getRegionUserRankingCached(regionId);
  return (
    <>
      <RankList rows={rows} userId={null} emptyText="이 지역은 아직 랭킹이 없어요." />
    </>
  );
}

async function WeeklyTab({ regionId }: { regionId: string | null }) {
  const rows = await getWeeklyRestaurantRankingCached(regionId);
  return (
    <>
      <RestaurantRankList rows={rows} />
    </>
  );
}

function RankList({ rows, userId, emptyText }: { rows: UserRankRow[]; userId: string | null; emptyText: string }) {
  if (rows.length === 0) return <p className="py-8 text-center text-sm text-ink-muted">{emptyText}</p>;
  const top = rows.slice(0, 3);
  const rest = rows.slice(3);
  return (
    <>
      <Podium rows={top} />
      <ol className="mt-4 divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200/80">
        {rest.map((r) => (
          <UserRow key={r.userId} row={r} highlight={!!userId && r.userId === userId} />
        ))}
      </ol>
    </>
  );
}

function Podium({ rows }: { rows: UserRankRow[] }) {
  if (rows.length === 0) return null;
  const first = rows[0];
  const second = rows[1];
  const third = rows[2];
  return (
    <section className="grid grid-cols-3 items-end gap-2">
      <PodiumCard row={second} height="pt-5" />
      <PodiumCard row={first} height="pt-2 pb-5" primary />
      <PodiumCard row={third} height="pt-7" />
    </section>
  );
}

function PodiumCard({ row, height, primary }: { row?: UserRankRow; height: string; primary?: boolean }) {
  if (!row) return <div />;
  return (
    <div className={`rounded-3xl border ${primary ? "border-coral bg-coral/10" : "border-stone-200 bg-white"} px-2.5 pb-3 text-center ${height}`}>
      <div className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full ${primary ? "bg-coral text-white" : "bg-forest-soft text-forest"}`}>
        {primary ? <Crown size={18} /> : <Medal size={17} />}
      </div>
      <div className="mt-2 text-[12px] font-black text-ink">#{row.rank}</div>
      <div className="mt-0.5 truncate text-[12px] font-bold text-ink">{row.nickname}</div>
      <div className="mt-1 text-[11px] text-stone-400">Lv.{row.level}</div>
    </div>
  );
}

function RestaurantRankList({ rows }: { rows: RestaurantRankRow[] }) {
  if (rows.length === 0) return <p className="py-8 text-center text-sm text-ink-muted">아직 이번 주 반응이 없어요.</p>;
  return (
    <ol className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200/80">
      {rows.map((r) => (
        <li key={r.restaurantId} className="flex items-center gap-3 bg-white p-3.5">
          <RankBadge rank={r.rank} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-ink">{r.name}</div>
            <div className="text-[11px] text-stone-400">{r.regionName} · 좋아요 {r.weekLikes} · 저장 {r.weekSaves}</div>
          </div>
          <span className="text-sm font-extrabold tabular-nums text-forest">
            {r.score}<span className="ml-0.5 text-[11px] font-medium text-stone-400">점</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
