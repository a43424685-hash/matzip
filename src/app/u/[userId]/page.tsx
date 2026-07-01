import { notFound } from "next/navigation";
import Link from "next/link";
import { MapPin, Lock } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { getMyOverallRank } from "@/server/ranking/RankingService";
import { getFollowCounts, isFollowing } from "@/server/follow/FollowService";
import DetailBackButton from "@/components/DetailBackButton";
import FollowButton from "@/components/FollowButton";
import OfficialBadge from "@/components/OfficialBadge";

export const dynamic = "force-dynamic";

export default async function UserProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, nickname: true, avatarUrl: true, totalLevel: true, totalXp: true, isAdmin: true, deactivatedAt: true },
  });
  if (!user || user.deactivatedAt) notFound();

  // 유료/무료 분리: 유료 지도에 잠긴(맛보기 아님) 글은 무료 프로필 목록에서 제외
  const lockedRows = await prisma.collectionItem.findMany({
    where: { isPreview: false, postId: { not: null }, collection: { userId, isPaid: true } },
    select: { postId: true },
  });
  const lockedIds = lockedRows.map((r) => r.postId).filter((x): x is string => !!x);

  // 팔로우 — 로그인한 다른 사람이 볼 때만 버튼 노출
  const viewerId = await getSessionUserId();
  const isOwnProfile = viewerId === user.id;
  const [followCounts, initialFollowing] = await Promise.all([
    getFollowCounts(user.id),
    viewerId && !isOwnProfile ? isFollowing(viewerId, user.id) : Promise.resolve(false),
  ]);

  const [rank, posts, maps] = await Promise.all([
    getMyOverallRank(userId),
    prisma.restaurantPost.findMany({
      // 남이 보는 공개 프로필 → "나만 보관(private)" 글은 제외 (본인은 내 기록 페이지에서 봄)
      where: { userId, visibility: "public", ...(lockedIds.length ? { id: { notIn: lockedIds } } : {}) },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        shortReview: true,
        restaurant: { select: { name: true } },
        media: { take: 1, orderBy: { sortOrder: "asc" }, select: { url: true } },
      },
    }),
    prisma.collection.findMany({
      where: { userId, isPaid: true, isPublic: true },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, priceWon: true, _count: { select: { items: true } } },
    }),
  ]);

  return (
    <main className="px-5 pb-10 pt-5">
      <header className="mb-5 flex items-center gap-3">
        <DetailBackButton />
        <h1 className="text-lg font-extrabold text-ink">프로필</h1>
      </header>

      {/* 프로필 헤더 */}
      <section className="flex items-center gap-4">
        <div className="relative shrink-0">
          <div className={`h-20 w-20 overflow-hidden rounded-full bg-forest-soft ${rank > 0 && rank <= 30 ? "ring-[3px] ring-amber-400" : "ring-2 ring-forest/15"}`}>
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-2xl font-black text-forest">{user.nickname.slice(0, 1)}</span>
            )}
          </div>
          {rank > 0 && rank <= 30 && <span className="absolute -right-1 -top-1 text-2xl leading-none drop-shadow">👑</span>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-xl font-extrabold text-ink">{user.nickname}</span>
            {user.isAdmin && <OfficialBadge size={18} />}
            <span className="badge-lv shrink-0">Lv.{user.totalLevel}</span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-[13px] text-ink-muted">
            <span>전체 <b className="text-ink">{rank > 0 ? `${rank}위` : "—"}</b></span>
            <span className="tabular-nums">{user.totalXp.toLocaleString()} XP</span>
          </div>
          <div className="mt-1.5 flex items-center gap-3 text-[13px] text-ink-muted">
            <Link href={`/u/${user.id}/followers`}>
              팔로워 <b className="text-ink tabular-nums">{followCounts.followers}</b>
            </Link>
            <Link href={`/u/${user.id}/following`}>
              팔로잉 <b className="text-ink tabular-nums">{followCounts.following}</b>
            </Link>
          </div>
        </div>
        {viewerId && !isOwnProfile && (
          <FollowButton targetId={user.id} initialFollowing={initialFollowing} />
        )}
      </section>

      {/* 유료 지도 */}
      {maps.length > 0 && (
        <section className="mt-7">
          <h2 className="mb-3 text-[15px] font-extrabold text-ink">판매 중인 맛집 지도</h2>
          <div className="space-y-2.5">
            {maps.map((m) => (
              <Link key={m.id} href={`/collections/${m.id}`} className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-forest-soft text-forest">
                  <MapPin size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-ink">{m.title}</div>
                  <div className="text-[12px] text-ink-muted">맛집 {m._count.items}곳</div>
                </div>
                <span className="shrink-0 text-sm font-black text-forest">{(m.priceWon ?? 0).toLocaleString()}원</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 등록한 맛집 */}
      <section className="mt-7">
        <h2 className="mb-3 text-[15px] font-extrabold text-ink">등록한 맛집 {posts.length > 0 && <span className="text-ink-muted">{posts.length}</span>}</h2>
        {posts.length === 0 ? (
          <p className="rounded-2xl bg-stone-50 py-8 text-center text-sm text-ink-muted">아직 등록한 맛집이 없어요.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {posts.map((p) => (
              <Link key={p.id} href={`/restaurants/${p.id}`} className="overflow-hidden rounded-2xl border border-stone-200/80 bg-white">
                <div className="aspect-[4/3] w-full bg-stone-100">
                  {p.media[0]?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.media[0].url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-stone-300"><Lock size={20} /></span>
                  )}
                </div>
                <div className="p-2.5">
                  <div className="truncate text-[13px] font-bold text-ink">{p.restaurant.name}</div>
                  {p.shortReview && <div className="mt-0.5 truncate text-[11px] text-ink-muted">{p.shortReview}</div>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
