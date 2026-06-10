import Link from "next/link";
import {
  AlertTriangle,
  BadgePercent,
  CheckCircle2,
  Gift,
  Lock,
  Megaphone,
  TicketPercent,
  Trophy,
  Utensils,
} from "lucide-react";
import BackHomeHeader from "@/components/BackHomeHeader";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getMyOverallRank } from "@/server/ranking/RankingService";

export const dynamic = "force-dynamic";

interface BenefitStats {
  rank: number;
  level: number;
  verifiedCount: number;
  publicCollections: number;
  bestRegionVerified: number;
  openReports: number;
  activeCampaigns: number;
}

export default async function BenefitsPage() {
  const user = await getCurrentUser();
  const [stats, promotions] = await Promise.all([
    user ? getBenefitStats(user.id, user.totalLevel) : null,
    getActivePromotions(),
  ]);

  return (
    <main className="px-5 py-6">
      <BackHomeHeader title="혜택 모음" />

      <section className="rounded-3xl bg-forest px-5 py-6 text-white">
        <div className="flex items-center gap-2">
          <BadgePercent size={24} className="text-coral" />
          <span className="text-sm font-extrabold text-white/75">랭킹을 올리는 이유</span>
        </div>
        <h1 className="mt-3 text-2xl font-black leading-tight">
          인증 맛집을 쌓으면
          <br />
          혜택과 수익화가 열립니다.
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-white/75">
          체험권, 쿠폰, 랭커 우선권, 유료 맛집 지도 자격을 한곳에서 확인합니다.
        </p>
      </section>

      <MyBenefitCard stats={stats} />

      <section className="mt-5 grid grid-cols-3 gap-2">
        <BenefitTile icon={<TicketPercent size={20} />} title="체험권" body="랭커 우선" />
        <BenefitTile icon={<Gift size={20} />} title="쿠폰" body="방문 혜택" />
        <BenefitTile icon={<Trophy size={20} />} title="랭커전용" body="상위권 보상" />
      </section>

      <HonestReviewPolicy />
      <CreatorMapSection stats={stats} />
      <CampaignSection promotions={promotions} />
    </main>
  );
}

async function getBenefitStats(userId: string, level: number): Promise<BenefitStats> {
  const [rank, verifiedPosts, publicCollections, activeCampaigns, openReports] = await Promise.all([
    getMyOverallRank(userId),
    prisma.restaurantPost.findMany({
      where: { userId, locationVerified: true },
      select: { restaurant: { select: { primaryRegionId: true } } },
    }),
    prisma.collection.count({ where: { userId, isPublic: true } }),
    prisma.ownerPromotion.count({
      where: { OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }] },
    }),
    countOpenReportsAgainstUser(userId),
  ]);

  const byRegion = new Map<string, number>();
  for (const post of verifiedPosts) {
    const regionId = post.restaurant.primaryRegionId;
    byRegion.set(regionId, (byRegion.get(regionId) ?? 0) + 1);
  }

  return {
    rank,
    level,
    verifiedCount: verifiedPosts.length,
    publicCollections,
    bestRegionVerified: Math.max(0, ...Array.from(byRegion.values())),
    openReports,
    activeCampaigns,
  };
}

async function countOpenReportsAgainstUser(userId: string): Promise<number> {
  const [posts, comments] = await Promise.all([
    prisma.restaurantPost.findMany({ where: { userId }, select: { id: true } }),
    prisma.comment.findMany({ where: { userId }, select: { id: true } }),
  ]);
  const filters: Array<{ targetType: string; targetId: { in: string[] } }> = [];
  const postIds = posts.map((p) => p.id);
  const commentIds = comments.map((c) => c.id);
  if (postIds.length) filters.push({ targetType: "post", targetId: { in: postIds } });
  if (commentIds.length) filters.push({ targetType: "comment", targetId: { in: commentIds } });
  if (filters.length === 0) return 0;
  return prisma.report.count({ where: { status: "open", OR: filters } });
}

async function getActivePromotions() {
  return prisma.ownerPromotion.findMany({
    where: {
      OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }],
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      title: true,
      content: true,
      promotionType: true,
      isAdLabeled: true,
      restaurant: {
        select: {
          name: true,
          posts: { select: { id: true }, take: 1, orderBy: { createdAt: "desc" } },
        },
      },
    },
  });
}

function MyBenefitCard({ stats }: { stats: BenefitStats | null }) {
  if (!stats) {
    return (
      <section className="mt-4 rounded-3xl border border-stone-200 bg-white p-5">
        <h2 className="text-base font-extrabold text-ink">내 혜택 자격</h2>
        <p className="mt-1 text-sm text-ink-muted">로그인하면 랭킹, 레벨, 인증 맛집 수를 기준으로 받을 수 있는 혜택을 보여줍니다.</p>
        <Link href="/login" className="btn-primary mt-4 block text-center">
          로그인하기
        </Link>
      </section>
    );
  }

  return (
    <section className="mt-4 rounded-3xl border border-stone-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-extrabold text-ink">내 혜택 자격</h2>
          <p className="mt-1 text-[12px] text-ink-muted">순위권에 들수록 신청 우선권이 높아집니다.</p>
        </div>
        <span className="rounded-full bg-forest-soft px-3 py-1 text-sm font-black text-forest">Lv.{stats.level}</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Metric label="전체 순위" value={stats.rank > 0 ? `#${stats.rank}` : "순위권 밖"} />
        <Metric label="인증 맛집" value={`${stats.verifiedCount}곳`} />
        <Metric label="혜택 진행" value={`${stats.activeCampaigns}개`} />
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-stone-50 px-2 py-3">
      <div className="text-[11px] text-ink-muted">{label}</div>
      <div className="mt-1 text-sm font-black text-ink">{value}</div>
    </div>
  );
}

function BenefitTile({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-2xl bg-white p-3 shadow-[0_1px_0_rgba(0,0,0,.08)]">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-forest-soft text-forest">{icon}</div>
      <div className="mt-2 text-sm font-extrabold text-ink">{title}</div>
      <div className="mt-0.5 text-[11px] text-ink-muted">{body}</div>
    </div>
  );
}

function HonestReviewPolicy() {
  return (
    <section className="mt-5 rounded-3xl border border-coral/25 bg-coral/5 p-5">
      <div className="flex items-center gap-2 text-sm font-extrabold text-coral">
        <AlertTriangle size={18} />
        솔직 리뷰 원칙
      </div>
      <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-ink">
        <li>체험권은 좋은 리뷰 조건이 아닙니다. 맛없으면 맛없다고 써야 합니다.</li>
        <li>체험권·협찬 참여 글은 앱에서 별도 표시합니다.</li>
        <li>허위 방문, 과장 리뷰, 거짓 참여가 확인되면 계정 제한 또는 영구 제명됩니다.</li>
      </ul>
    </section>
  );
}

function CreatorMapSection({ stats }: { stats: BenefitStats | null }) {
  const checks = [
    { label: "Lv.20 이상", ok: (stats?.level ?? 1) >= 20, value: `Lv.${stats?.level ?? 1}/20` },
    { label: "위치 인증 맛집 30곳 이상", ok: (stats?.verifiedCount ?? 0) >= 30, value: `${stats?.verifiedCount ?? 0}/30` },
    { label: "공개 맛집 리스트 3개 이상", ok: (stats?.publicCollections ?? 0) >= 3, value: `${stats?.publicCollections ?? 0}/3` },
    { label: "한 지역 인증 30곳 이상", ok: (stats?.bestRegionVerified ?? 0) >= 30, value: `${stats?.bestRegionVerified ?? 0}/30` },
    { label: "미해결 신고 0건", ok: (stats?.openReports ?? 0) === 0, value: `${stats?.openReports ?? 0}건` },
  ];

  return (
    <section className="mt-5 rounded-3xl border border-stone-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-forest text-white">
          <Utensils size={21} />
        </span>
        <div>
          <h2 className="text-base font-extrabold text-ink">유료 맛집 지도</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
            자격을 채우면 본인이 고른 맛집 20곳을 무료 맛보기로 공개하고, 나머지는 결제로 열 수 있습니다.
          </p>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {checks.map((check) => (
          <div key={check.label} className="flex items-center justify-between rounded-2xl bg-stone-50 px-3 py-2.5">
            <span className="flex items-center gap-2 text-[13px] font-bold text-ink">
              {check.ok ? <CheckCircle2 size={16} className="text-forest" /> : <Lock size={16} className="text-stone-400" />}
              {check.label}
            </span>
            <span className={`text-[12px] font-black ${check.ok ? "text-forest" : "text-stone-400"}`}>{check.value}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[12px] leading-relaxed text-ink-muted">
        무료 20곳도 운영 정책을 통과해야 합니다. 일부러 약한 맛집만 무료로 보여주는 방식은 제한합니다.
      </p>
    </section>
  );
}

function CampaignSection({ promotions }: { promotions: Awaited<ReturnType<typeof getActivePromotions>> }) {
  return (
    <section className="mt-8">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="section-title">진행 중인 혜택</h2>
          <p className="mt-1 text-[13px] text-ink-muted">쿠폰, 사장님 소식, 체험권이 여기에 쌓입니다.</p>
        </div>
        <Megaphone size={22} className="text-forest" />
      </div>

      {promotions.length === 0 ? (
        <div className="mt-3 rounded-3xl bg-stone-50 px-4 py-8 text-center">
          <p className="text-sm font-semibold text-ink">아직 등록된 혜택이 없어요.</p>
          <p className="mt-1 text-[13px] text-ink-muted">사장님 홍보와 체험권 등록 흐름이 붙으면 채워집니다.</p>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {promotions.map((promotion) => {
            const postId = promotion.restaurant.posts[0]?.id;
            return (
              <Link
                key={promotion.id}
                href={postId ? `/restaurants/${postId}` : "/benefits"}
                className="card block p-4 active:scale-[0.99]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[12px] font-bold text-forest">{promotion.restaurant.name}</div>
                  {promotion.isAdLabeled && (
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-500">표시됨</span>
                  )}
                </div>
                <div className="mt-1 text-sm font-extrabold text-ink">{promotion.title}</div>
                {promotion.content && <p className="mt-1 line-clamp-2 text-[13px] text-ink-muted">{promotion.content}</p>}
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
