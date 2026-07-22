import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Menu,
  Bell,
  Pencil,
  Share2,
  ShieldCheck,
  Coins,
  ShoppingBag,
  Bookmark,
  ChevronRight,
  Grid3x3,
  Map as MapIcon,
  Utensils,
  Plus,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import OfficialBadge from "@/components/OfficialBadge";
import ProfileGrid from "@/components/ProfileGrid";
import { getFollowCounts } from "@/server/follow/FollowService";
import { getMyOverallRank, getMyRegionRanks } from "@/server/ranking/RankingService";
import { unreadCount } from "@/server/notification/NotificationService";
import { calculateLevel } from "@/server/xp/LevelService";
import { getProfileGrid, type GridItem } from "@/server/profile/ProfileGridService";
import MyRestaurantsMap from "@/components/MyRestaurantsMap";

export const dynamic = "force-dynamic";

const LEVEL_GOAL = 20;
const VERIFY_GOAL = 30;

type Tab = "posts" | "verified" | "maps";

export default async function MePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const sp = await searchParams;
  const tab: Tab = sp.tab === "verified" ? "verified" : sp.tab === "maps" ? "maps" : "posts";

  const prog = calculateLevel(user.totalXp);

  const [counts, overallRank, regionRanks, postCount, verifiedCount, savedCount, collectionsCount, purchasedCount, unread] =
    await Promise.all([
      getFollowCounts(user.id),
      getMyOverallRank(user.id),
      getMyRegionRanks(user.id),
      prisma.restaurantPost.count({ where: { userId: user.id } }),
      prisma.restaurantPost.count({ where: { userId: user.id, locationVerified: true } }),
      prisma.save.count({ where: { userId: user.id } }),
      prisma.collection.count({ where: { userId: user.id } }),
      prisma.mapPurchase.count({ where: { buyerId: user.id } }),
      unreadCount(user.id),
    ]);

  // 지도(리스트)가 하나라도 있으면 판매자 센터(정산·유료지도 관리) 진입을 보여준다
  const isSeller = collectionsCount > 0;
  const mapUnlocked = user.totalLevel >= LEVEL_GOAL && verifiedCount >= VERIFY_GOAL;
  const topRegion = regionRanks[0];

  // 활성 탭 데이터
  let gridPosts: GridItem[] = [];
  let myPins: { postId: string; name: string; lat: number; lng: number }[] = [];
  if (tab === "maps") {
    // 내가 등록한 맛집을 지도에 — 좌표 있는 것만, 같은 가게는 1핀으로
    const rows = await prisma.restaurantPost.findMany({
      where: { userId: user.id, restaurant: { latitude: { not: null }, longitude: { not: null } } },
      orderBy: { createdAt: "desc" },
      select: { id: true, restaurant: { select: { name: true, latitude: true, longitude: true } } },
    });
    const seen = new Set<string>();
    for (const r of rows) {
      const { latitude, longitude, name } = r.restaurant;
      if (latitude == null || longitude == null) continue;
      const key = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      myPins.push({ postId: r.id, name, lat: latitude, lng: longitude });
    }
  } else {
    gridPosts = await getProfileGrid(user.id, user.id, tab, 0);
  }

  return (
    <main className="pb-24">
      {/* 상단 바 — 좌 닉네임, 우 알림·삼선 */}
      <header className="flex items-center justify-between px-5 pt-4">
        <div className="flex items-center gap-1.5 text-lg font-black text-ink">
          {user.nickname}
          {user.isAdmin && <OfficialBadge size={16} />}
        </div>
        <div className="flex items-center gap-3">
          <Link href="/notifications" className="relative text-stone-500" aria-label="알림">
            <Bell size={22} strokeWidth={1.9} />
            {unread > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-coral px-1 text-[10px] font-bold text-white">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </Link>
          <Link href="/me/menu" className="text-ink" aria-label="설정 및 활동">
            <Menu size={24} strokeWidth={2.1} />
          </Link>
        </div>
      </header>

      {/* 프로필 헤더 */}
      <section className="px-5 pt-4">
        <div className="flex items-center gap-5">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-forest-soft text-2xl font-extrabold text-forest">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              user.nickname.slice(0, 1)
            )}
          </div>
          {/* 카운트 3분할 — 전부 탭 가능 */}
          <div className="grid flex-1 grid-cols-3 text-center">
            <CountCell label="게시물" value={postCount} href="/me?tab=posts" />
            <CountCell label="팔로워" value={counts.followers} href={`/u/${user.id}/followers`} />
            <CountCell label="팔로잉" value={counts.following} href={`/u/${user.id}/following`} />
          </div>
        </div>

        {/* 레벨 + 진행바 */}
        <div className="mt-3 flex items-center gap-2">
          <span className="badge-lv">Lv.{user.totalLevel}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-100">
            <div className="h-full rounded-full bg-forest" style={{ width: `${Math.round(prog.progress * 100)}%` }} />
          </div>
          <span className="text-[11px] tabular-nums text-stone-400">
            {prog.isMaxLevel ? "만렙" : `${prog.xpIntoLevel.toLocaleString()} XP`}
          </span>
        </div>

        {/* 신뢰 스트립 */}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-muted">
          <span className="flex items-center gap-1">
            <ShieldCheck size={14} className="text-forest" /> 인증 <b className="text-ink">{verifiedCount}</b>
          </span>
          {overallRank > 0 && (
            <span>전체 <b className="text-ink">{overallRank}위</b></span>
          )}
          {topRegion && (
            <span>
              🏅 {topRegion.regionName} <b className="text-ink">{topRegion.rank}위</b>
            </span>
          )}
        </div>

        {/* 편집 / 공유 */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link
            href="/me/profile"
            className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-stone-100 text-[14px] font-bold text-ink active:scale-[0.99]"
          >
            <Pencil size={15} /> 프로필 편집
          </Link>
          <Link
            href={`/u/${user.id}`}
            className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-stone-100 text-[14px] font-bold text-ink active:scale-[0.99]"
          >
            <Share2 size={15} /> 공개 프로필
          </Link>
        </div>
      </section>

      {/* 판매자 센터 / 유료지도 (돈은 프로필에 노출) */}
      <section className="mt-5 px-5">
        {isSeller ? (
          <Link
            href="/me/earnings"
            className="flex items-center gap-3 rounded-2xl border border-forest/20 bg-forest-soft/30 p-4 active:scale-[0.99]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest text-white">
              <Coins size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-extrabold text-ink">판매자 센터</div>
              <div className="text-[12px] text-ink-muted">판매 수익 · 정산 계좌 · 유료지도 관리</div>
            </div>
            <ChevronRight size={18} className="text-forest" />
          </Link>
        ) : mapUnlocked ? (
          <Link
            href="/me/paid-map"
            className="flex h-12 items-center justify-center rounded-2xl bg-forest text-sm font-bold text-white active:scale-[0.99]"
          >
            유료 맛집지도 만들기 (조건 달성!)
          </Link>
        ) : (
          <div className="rounded-2xl border border-forest/20 bg-forest-soft/30 p-4">
            <div className="flex items-center gap-1.5">
              <MapIcon size={16} className="text-forest" />
              <h2 className="text-[14px] font-extrabold text-ink">유료 맛집지도 오픈까지</h2>
            </div>
            <div className="mt-3 space-y-2.5">
              <Mini label="레벨" now={user.totalLevel} goal={LEVEL_GOAL} suffix="" />
              <Mini label="위치 인증 맛집" now={verifiedCount} goal={VERIFY_GOAL} suffix="곳" />
            </div>
          </div>
        )}

        {/* 빠른 접근 — 구매/저장 */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Quick href="/me/purchases" icon={<ShoppingBag size={16} />} label="구매한 지도" value={purchasedCount} />
          <Quick href="/me/saved" icon={<Bookmark size={16} />} label="저장한 맛집" value={savedCount} />
        </div>
      </section>

      {/* 콘텐츠 탭 */}
      <nav className="mt-6 grid grid-cols-3 border-y border-stone-200">
        <TabLink tab="posts" active={tab} icon={<Grid3x3 size={18} />} label="내 글" />
        <TabLink tab="verified" active={tab} icon={<ShieldCheck size={18} />} label="인증" />
        <TabLink tab="maps" active={tab} icon={<MapIcon size={18} />} label="지도" />
      </nav>

      {/* 콘텐츠 */}
      {tab === "maps" ? (
        <div className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[13px] text-ink-muted">내가 등록한 맛집 {myPins.length}곳</p>
            <Link href="/me/collections" className="flex items-center text-[13px] font-semibold text-forest">
              내 리스트 관리 <ChevronRight size={14} />
            </Link>
          </div>
          {myPins.length === 0 ? (
            <EmptyGrid text="지도에 표시할 맛집이 없어요. 맛집을 등록해보세요!" />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-stone-200">
              <MyRestaurantsMap pins={myPins} />
            </div>
          )}
        </div>
      ) : gridPosts.length === 0 ? (
        <EmptyGrid
          text={tab === "verified" ? "아직 위치 인증한 맛집이 없어요." : "아직 등록한 맛집이 없어요."}
          cta
        />
      ) : (
        <ProfileGrid userId={user.id} tab={tab} initial={gridPosts} />
      )}

      {/* 맛집 등록 FAB */}
      <Link
        href="/register"
        aria-label="맛집 등록"
        className="fixed bottom-[88px] right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-forest text-white shadow-[0_8px_24px_rgba(31,77,63,.4)] active:scale-95"
      >
        <Plus size={28} strokeWidth={2.4} />
      </Link>
    </main>
  );
}

function CountCell({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="active:opacity-60">
      <div className="text-lg font-extrabold tabular-nums text-ink">{value.toLocaleString()}</div>
      <div className="text-[12px] text-stone-400">{label}</div>
    </Link>
  );
}

function Mini({ label, now, goal, suffix }: { label: string; now: number; goal: number; suffix: string }) {
  const pct = Math.min(100, Math.round((now / goal) * 100));
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-[12px]">
        <span className="font-semibold text-ink">{label}</span>
        <span className="tabular-nums text-ink-muted">
          <b className="text-forest">{now}</b> / {goal}
          {suffix}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white">
        <div className="h-full rounded-full bg-forest" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Quick({ href, icon, label, value }: { href: string; icon: React.ReactNode; label: string; value: number }) {
  return (
    <Link href={href} className="flex items-center gap-2 rounded-2xl border border-stone-200 p-3 active:scale-[0.99]">
      <span className="text-forest">{icon}</span>
      <span className="flex-1 text-[13px] font-bold text-ink">{label}</span>
      <span className="text-[13px] font-extrabold tabular-nums text-stone-400">{value}</span>
    </Link>
  );
}

function TabLink({ tab, active, icon, label }: { tab: Tab; active: Tab; icon: React.ReactNode; label: string }) {
  const on = tab === active;
  return (
    <Link
      href={`/me?tab=${tab}`}
      className={`flex items-center justify-center gap-1.5 py-2.5 text-[13px] font-bold ${
        on ? "border-b-2 border-ink text-ink" : "text-stone-400"
      }`}
    >
      {icon} {label}
    </Link>
  );
}

function EmptyGrid({ text, cta }: { text: string; cta?: boolean }) {
  return (
    <div className="px-6 py-16 text-center">
      <p className="text-[14px] text-stone-400">{text}</p>
      {cta && (
        <Link
          href="/register"
          className="mt-4 inline-flex items-center gap-1 rounded-full bg-forest px-4 py-2 text-[13px] font-bold text-white"
        >
          <Utensils size={15} /> 첫 맛집 올리기
        </Link>
      )}
    </div>
  );
}

