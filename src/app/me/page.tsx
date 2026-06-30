import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  ChevronRight,
  Bell,
  Bookmark,
  Utensils,
  ListChecks,
  Map,
  Coins,
  ShoppingBag,
  Gift,
  Megaphone,
  FileText,
  Heart,
  Share2,
  ShieldAlert,
  Settings,
  Headphones,
  Info,
  Upload,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import OfficialBadge from "@/components/OfficialBadge";
import LogoutButton from "@/components/LogoutButton";
import { getMyOverallRank, getMyRegionRanks } from "@/server/ranking/RankingService";
import { unreadCount } from "@/server/notification/NotificationService";
import { calculateLevel } from "@/server/xp/LevelService";

export const dynamic = "force-dynamic";

// 유료 맛집지도 오픈 조건 (확장 가능 — 나중에 무료 공개 맛집 20개 등 추가)
const LEVEL_GOAL = 20;
const VERIFY_GOAL = 30;

export default async function MePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const prog = calculateLevel(user.totalXp);

  const [overallRank, regionRanks, verifiedCount, registeredCount, savedCount, collectionsCount, unread] =
    await Promise.all([
      getMyOverallRank(user.id),
      getMyRegionRanks(user.id),
      prisma.restaurantPost.count({ where: { userId: user.id, locationVerified: true } }),
      prisma.restaurantPost.count({ where: { userId: user.id } }),
      prisma.save.count({ where: { userId: user.id } }),
      prisma.collection.count({ where: { userId: user.id } }),
      unreadCount(user.id),
    ]);

  const levelPct = Math.min(100, Math.round((user.totalLevel / LEVEL_GOAL) * 100));
  const verifyPct = Math.min(100, Math.round((verifiedCount / VERIFY_GOAL) * 100));
  const mapUnlocked = user.totalLevel >= LEVEL_GOAL && verifiedCount >= VERIFY_GOAL;

  return (
    <main className="px-5 pb-10 pt-5">
      {/* 상단 바 — 좌측 뒤로(홈), 가운데 제목 */}
      <header className="relative mb-6 flex h-10 items-center justify-center">
        <Link
          href="/"
          aria-label="홈으로"
          className="absolute left-0 flex h-10 w-10 items-center justify-center rounded-full text-ink active:scale-95"
        >
          <ArrowLeft size={22} strokeWidth={2.2} />
        </Link>
        <h1 className="text-lg font-extrabold text-ink">내 정보</h1>
      </header>

      {/* 프로필 */}
      <a href="/me/profile" className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-forest-soft text-2xl font-extrabold text-forest">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt="" loading="lazy" decoding="async" className="h-16 w-16 object-cover" />
          ) : (
            user.nickname.slice(0, 1)
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-xl font-extrabold text-ink">{user.nickname}</span>
            {user.isAdmin && <OfficialBadge size={18} />}
            <span className="badge-lv shrink-0">Lv.{user.totalLevel}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-ink-muted">
            <span>
              전체 <b className="text-ink">{overallRank > 0 ? `${overallRank}위` : "—"}</b>
            </span>
            {regionRanks.slice(0, 3).map((r, i) => (
              <span key={r.regionName}>
                {i === 0 && r.rank <= 3 && "🥇 "}
                {r.regionName} <b className="text-ink">{r.rank}위</b>
              </span>
            ))}
          </div>
          {/* 경험치 게이지 */}
          <div className="mt-2">
            <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
              <div className="h-full rounded-full bg-forest" style={{ width: `${Math.round(prog.progress * 100)}%` }} />
            </div>
            <div className="mt-1 text-[11px] tabular-nums text-stone-400">
              {prog.isMaxLevel
                ? "만렙 달성 🎉"
                : `${prog.xpIntoLevel.toLocaleString()} / ${(prog.nextLevelXp - prog.currentLevelFloorXp).toLocaleString()} XP`}
            </div>
          </div>
        </div>
        <ChevronRight size={20} className="shrink-0 text-stone-300" />
      </a>

      {/* 핵심 성장 카드 — 유료 맛집지도 오픈 조건 */}
      <section className="mt-6 rounded-2xl border border-forest/20 bg-forest-soft/30 p-5">
        <div className="flex items-center gap-1.5">
          <Map size={17} className="text-forest" />
          <h2 className="text-[15px] font-extrabold text-ink">유료 맛집지도 오픈까지</h2>
        </div>

        <div className="mt-4 space-y-3.5">
          <Progress
            label="레벨"
            now={`Lv.${user.totalLevel}`}
            goal={`Lv.${LEVEL_GOAL}`}
            pct={levelPct}
          />
          <Progress
            label="위치 인증 맛집"
            now={`${verifiedCount}`}
            goal={`${VERIFY_GOAL}곳`}
            pct={verifyPct}
          />
        </div>

        {mapUnlocked ? (
          <a
            href="/me/paid-map"
            className="mt-4 flex h-11 items-center justify-center rounded-xl bg-forest text-sm font-bold text-white active:scale-[0.99]"
          >
            유료 맛집지도 만들기
          </a>
        ) : (
          <>
            <p className="mt-3 text-[12px] text-ink-muted">
              조건을 모두 달성하면 유료 맛집지도를 열 수 있어요. 맛집을 등록하고 현장에서 위치 인증해보세요.
            </p>
            <a
              href="/register"
              className="mt-3 flex h-11 items-center justify-center rounded-xl border border-forest/30 bg-forest-soft/40 text-sm font-bold text-forest active:scale-[0.99]"
            >
              맛집 등록하러 가기
            </a>
          </>
        )}
      </section>

      {/* 빠른 메뉴 4 */}
      <section className="mt-6 grid grid-cols-4 gap-2">
        <Quick href="/me/posts" icon={<Utensils size={20} />} label="내 등록" value={registeredCount} />
        <Quick href="/me/saved" icon={<Bookmark size={20} />} label="저장" value={savedCount} />
        <Quick href="/me/collections" icon={<ListChecks size={20} />} label="리스트" value={collectionsCount} />
        <Quick href="/notifications" icon={<Bell size={20} />} label="알림함" badge={unread} />
      </section>

      {/* 수익화 · 혜택 */}
      <Section title="수익화 · 혜택">
        <Row href="/me/purchases" icon={<ShoppingBag size={18} />} label="구매한 지도" sub="내가 산 유료 맛집 지도" />
        <Row href="/me/paid-map" icon={<Map size={18} />} label="유료 맛집지도 관리" sub="조건 달성 후 오픈 가능" />
        <Row href="/me/earnings" icon={<Coins size={18} />} label="판매 수익 내역" sub="수수료 차감 후 정산 예정" />
        <Row href="/me/benefits" icon={<Gift size={18} />} label="혜택 모음" />
        <Row href="/me/review-campaigns" icon={<Megaphone size={18} />} label="정직 리뷰 캠페인" />
      </Section>

      {user.isAdmin && (
        <Section title="운영자">
          <Row
            href="/me/admin/import"
            icon={<Upload size={18} />}
            label="맛집 일괄등록"
            sub="네이버 즐겨찾기로 운영자 PICK 한번에 등록"
          />
        </Section>
      )}

      {/* 활동 관리 */}
      <Section title="활동 관리">
        <Row href="/me/reactions" icon={<Heart size={18} />} label="받은 좋아요·저장" />
        <Row href="/me/shared" icon={<Share2 size={18} />} label="공유한 맛집" />
        <Row href="/me/blocked-users" icon={<ShieldAlert size={18} />} label="차단한 사용자" />
        <Row href="/me/reports" icon={<ShieldAlert size={18} />} label="신고/제재 내역" />
      </Section>

      {/* 운영자 전용 */}
      {user.isAdmin && (
        <Section title="운영자">
          <Row href="/admin" icon={<ShieldAlert size={18} />} label="관리자 콘솔" sub="정산·환불·신고 관리" />
        </Section>
      )}

      {/* 고객 · 설정 */}
      <Section title="고객 · 설정">
        <Row href="/me/notices" icon={<Info size={18} />} label="공지사항" />
        <Row href="/me/support" icon={<Headphones size={18} />} label="고객센터" />
        <Row href="/me/settings" icon={<Settings size={18} />} label="설정" />
        <Row href="/terms" icon={<FileText size={18} />} label="약관 및 정책" sub="이용약관·개인정보·환불정책" />
        <LogoutButton />
      </Section>
    </main>
  );
}

function Progress({ label, now, goal, pct }: { label: string; now: string; goal: string; pct: number }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-[13px]">
        <span className="font-semibold text-ink">{label}</span>
        <span className="tabular-nums text-ink-muted">
          <b className="text-forest">{now}</b> / {goal}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white">
        <div className="h-full rounded-full bg-forest" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Quick({
  href,
  icon,
  label,
  value,
  badge,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value?: number;
  badge?: number;
}) {
  return (
    <a href={href} className="flex flex-col items-center gap-1.5 rounded-2xl border border-stone-200 py-3 active:scale-95">
      <span className="relative text-forest">
        {icon}
        {badge != null && badge > 0 && (
          <span className="absolute -right-2 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-coral px-1 text-[10px] font-bold text-white">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </span>
      <span className="text-[12px] font-bold text-ink">{label}</span>
      {value != null && <span className="text-[11px] tabular-nums text-stone-400">{value}</span>}
    </a>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-1 px-1 text-[13px] font-bold text-stone-400">{title}</h2>
      <div className="divide-y divide-stone-100">{children}</div>
    </section>
  );
}

function Row({
  href,
  icon,
  label,
  sub,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  sub?: string;
}) {
  return (
    <a href={href} className="flex items-center gap-3 px-1 py-3.5 active:bg-stone-50">
      <span className="text-stone-400">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] text-ink">{label}</span>
        {sub && <span className="block text-[12px] text-stone-400">{sub}</span>}
      </span>
      <ChevronRight size={18} className="shrink-0 text-stone-300" />
    </a>
  );
}
