import { notFound } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, Grid3x3, Map as MapIcon, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { getMyOverallRank, getMyRegionRanks } from "@/server/ranking/RankingService";
import { getFollowCounts, isFollowing } from "@/server/follow/FollowService";
import DetailBackButton from "@/components/DetailBackButton";
import FollowButton from "@/components/FollowButton";
import OfficialBadge from "@/components/OfficialBadge";
import ProfileGrid from "@/components/ProfileGrid";
import MyRestaurantsMap from "@/components/MyRestaurantsMap";
import { getProfileGrid } from "@/server/profile/ProfileGridService";
import { visiblePostWhere } from "@/server/visibility/PaidVisibility";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

type Tab = "posts" | "verified" | "maps";

export default async function UserProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { userId } = await params;
  const sp = await searchParams;
  const tab: Tab = sp.tab === "verified" ? "verified" : sp.tab === "maps" ? "maps" : "posts";

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, nickname: true, avatarUrl: true, totalLevel: true, totalXp: true, isAdmin: true, deactivatedAt: true },
  });
  if (!user || user.deactivatedAt) notFound();

  const viewerId = await getSessionUserId();
  const isOwnProfile = viewerId === user.id;
  // 유료 잠금 글 제외 — 중앙 정책(소유자/구매자/관리자는 봄)
  const baseWhere: Prisma.RestaurantPostWhereInput = {
    userId,
    visibility: "public",
    AND: [await visiblePostWhere(viewerId)],
  };

  const [followCounts, initialFollowing, rank, regionRanks, postCount, verifiedCount, acceptedCount, maps] = await Promise.all([
    getFollowCounts(user.id),
    viewerId && !isOwnProfile ? isFollowing(viewerId, user.id) : Promise.resolve(false),
    getMyOverallRank(userId),
    getMyRegionRanks(userId),
    prisma.restaurantPost.count({ where: baseWhere }),
    prisma.restaurantPost.count({ where: { ...baseWhere, locationVerified: true } }),
    prisma.communityComment.count({ where: { userId, isAccepted: true } }),
    prisma.collection.findMany({
      where: { userId, isPaid: true, isPublic: true },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, priceWon: true, _count: { select: { items: true } } },
    }),
  ]);

  // 활성 탭 데이터 (무한 스크롤은 ProfileGrid가 처리)
  const gridPosts = tab === "maps" ? [] : await getProfileGrid(userId, viewerId, tab, 0);

  // 지도 탭 — 이 사람이 등록한 맛집을 지도에 핀으로 (좌표 있는 것만, 같은 가게 1핀)
  let myPins: { postId: string; name: string; lat: number; lng: number }[] = [];
  if (tab === "maps") {
    const rows = await prisma.restaurantPost.findMany({
      where: { ...baseWhere, restaurant: { latitude: { not: null }, longitude: { not: null } } },
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
  }

  const topRegion = regionRanks[0];
  const isRanker = rank > 0 && rank <= 30;

  return (
    <main className="pb-16">
      <header className="flex items-center gap-3 px-5 pb-3 pt-5">
        <DetailBackButton />
        <h1 className="text-lg font-extrabold text-ink">프로필</h1>
      </header>

      {/* 프로필 헤더 */}
      <section className="px-5">
        <div className="flex items-center gap-5">
          <div className="relative shrink-0">
            <div className={`h-20 w-20 overflow-hidden rounded-full bg-forest-soft ${isRanker ? "ring-[3px] ring-amber-400" : "ring-2 ring-forest/15"}`}>
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatarUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-2xl font-black text-forest">{user.nickname.slice(0, 1)}</span>
              )}
            </div>
            {isRanker && <span className="absolute -right-1 -top-1 text-2xl leading-none drop-shadow">👑</span>}
          </div>
          {/* 카운트 3분할 — 탭→목록 */}
          <div className="grid flex-1 grid-cols-3 text-center">
            <div>
              <div className="text-lg font-extrabold tabular-nums text-ink">{postCount.toLocaleString()}</div>
              <div className="text-[12px] text-stone-400">게시물</div>
            </div>
            <Link href={`/u/${user.id}/followers`} className="active:opacity-60">
              <div className="text-lg font-extrabold tabular-nums text-ink">{followCounts.followers.toLocaleString()}</div>
              <div className="text-[12px] text-stone-400">팔로워</div>
            </Link>
            <Link href={`/u/${user.id}/following`} className="active:opacity-60">
              <div className="text-lg font-extrabold tabular-nums text-ink">{followCounts.following.toLocaleString()}</div>
              <div className="text-[12px] text-stone-400">팔로잉</div>
            </Link>
          </div>
        </div>

        {/* 닉네임 + 레벨 */}
        <div className="mt-3 flex items-center gap-1.5">
          <span className="text-lg font-black text-ink">{user.nickname}</span>
          {user.isAdmin && <OfficialBadge size={16} />}
          <span className="badge-lv shrink-0">Lv.{user.totalLevel}</span>
        </div>

        {/* 신뢰 스트립 */}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-muted">
          <span className="flex items-center gap-1">
            <ShieldCheck size={14} className="text-forest" /> 인증 <b className="text-ink">{verifiedCount}</b>
          </span>
          {rank > 0 && <span>전체 <b className="text-ink">{rank}위</b></span>}
          {topRegion && (
            <span>🏅 {topRegion.regionName} <b className="text-ink">{topRegion.rank}위</b></span>
          )}
          {acceptedCount > 0 && (
            <span>💬 답변 채택 <b className="text-ink">{acceptedCount}</b></span>
          )}
          <span className="tabular-nums">{user.totalXp.toLocaleString()} XP</span>
        </div>

        {/* 팔로우 (풀폭) */}
        {viewerId && !isOwnProfile && (
          <div className="mt-4">
            <FollowButton targetId={user.id} initialFollowing={initialFollowing} full nickname={user.nickname} />
          </div>
        )}

        {/* 판매 지도 넛지 (판매자면) */}
        {maps.length > 0 && tab !== "maps" && (
          <Link
            href={`/u/${user.id}?tab=maps`}
            className="mt-3 flex items-center gap-2 rounded-2xl border border-forest/20 bg-forest-soft/30 p-3.5 active:scale-[0.99]"
          >
            <MapIcon size={17} className="text-forest" />
            <span className="flex-1 text-[14px] font-bold text-ink">이 미식가의 유료 지도 {maps.length}개</span>
            <ChevronRight size={17} className="text-forest" />
          </Link>
        )}
      </section>

      {/* 콘텐츠 탭 */}
      <nav className="mt-5 grid grid-cols-3 border-y border-stone-200">
        <TabLink userId={user.id} tab="posts" active={tab} icon={<Grid3x3 size={18} />} label="등록한 맛집" />
        <TabLink userId={user.id} tab="verified" active={tab} icon={<ShieldCheck size={18} />} label="인증" />
        <TabLink userId={user.id} tab="maps" active={tab} icon={<MapIcon size={18} />} label="지도" />
      </nav>

      {tab === "maps" ? (
        <div className="p-4">
          {/* 이 사람이 등록한 맛집 지도 */}
          <p className="mb-2 text-[13px] text-ink-muted">등록한 맛집 {myPins.length}곳</p>
          {myPins.length === 0 ? (
            <Empty text="지도에 표시할 맛집이 없어요." />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-stone-200">
              <MyRestaurantsMap pins={myPins} />
            </div>
          )}
          {/* 판매 중인 유료 지도 (있으면 아래에) */}
          {maps.length > 0 && (
            <section className="mt-6 space-y-2.5">
              <h2 className="flex items-center gap-1.5 text-sm font-extrabold text-ink">
                <MapIcon size={15} className="text-forest" /> 판매 중인 지도 {maps.length}개
              </h2>
              {maps.map((m) => (
                <Link key={m.id} href={`/collections/${m.id}`} className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-4 active:bg-stone-50">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-forest-soft text-forest">
                    <MapIcon size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-ink">{m.title}</div>
                    <div className="text-[12px] text-ink-muted">맛집 {m._count.items}곳</div>
                  </div>
                  <span className="shrink-0 text-sm font-black text-forest">{(m.priceWon ?? 0).toLocaleString()}원</span>
                </Link>
              ))}
            </section>
          )}
        </div>
      ) : gridPosts.length === 0 ? (
        <Empty text={tab === "verified" ? "아직 위치 인증한 맛집이 없어요." : "아직 등록한 맛집이 없어요."} />
      ) : (
        <ProfileGrid userId={userId} tab={tab} initial={gridPosts} />
      )}
    </main>
  );
}

function TabLink({ userId, tab, active, icon, label }: { userId: string; tab: Tab; active: Tab; icon: React.ReactNode; label: string }) {
  const on = tab === active;
  return (
    <Link
      href={`/u/${userId}?tab=${tab}`}
      className={`flex items-center justify-center gap-1.5 py-2.5 text-[13px] font-bold ${
        on ? "border-b-2 border-ink text-ink" : "text-stone-400"
      }`}
    >
      {icon} {label}
    </Link>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-6 py-16 text-center text-[14px] text-stone-400">{text}</p>;
}
