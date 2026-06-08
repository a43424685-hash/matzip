import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Lock, ChevronRight, Bookmark } from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";
import {
  toPostCard,
  postCardSelect,
  getViewerReactions,
} from "@/server/restaurant/RestaurantService";
import { getMyCollectionsWithPreview } from "@/server/collection/CollectionService";
import LevelBar from "@/components/LevelBar";
import PostCard from "@/components/PostCard";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [regionStats, myPosts, savedRows, collections] = await Promise.all([
    prisma.userRegionStat.findMany({
      where: { userId: user.id, regionXp: { gt: 0 } },
      orderBy: { regionXp: "desc" },
      select: { regionXp: true, regionLevel: true, region: { select: { name: true } } },
    }),
    prisma.restaurantPost.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: postCardSelect,
    }),
    prisma.save.findMany({
      where: { userId: user.id, postId: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { post: { select: postCardSelect } },
    }),
    getMyCollectionsWithPreview(user.id),
  ]);

  const myCards = myPosts.map(toPostCard);
  const savedCards = savedRows
    .map((s) => s.post)
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map(toPostCard);

  const reactionIds = [...myCards, ...savedCards];
  const { likedPosts, savedRestaurants } = await getViewerReactions(
    user.id,
    reactionIds.map((p) => p.id),
    reactionIds.map((p) => p.restaurantId)
  );

  return (
    <main className="px-5 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold">{user.nickname}</h1>
          <p className="text-xs text-neutral-400">{user.email}</p>
        </div>
        <form action={logoutAction}>
          <button className="btn-ghost !py-1.5 !text-xs">로그아웃</button>
        </form>
      </div>

      {/* 전체 레벨 */}
      <LevelBar xp={user.totalXp} label="전체 레벨" />

      {/* 지역 레벨 요약 */}
      <section className="mt-5">
        <h2 className="mb-2 text-sm font-bold text-neutral-700">지역별 레벨</h2>
        {regionStats.length === 0 ? (
          <p className="text-sm text-neutral-400">아직 지역 활동이 없어요. 맛집을 등록하면 지역 레벨이 올라요.</p>
        ) : (
          <div className="space-y-2">
            {regionStats.map((s) => (
              <div key={s.region.name} className="card p-3">
                <LevelBar xp={s.regionXp} label={s.region.name} compact />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 내 맛집 리스트 (컬렉션) */}
      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink">내 맛집 리스트 ({collections.length})</h2>
          <Link href="/collections/new" className="flex items-center gap-0.5 text-[13px] font-semibold text-forest">
            <Plus size={15} /> 새 리스트
          </Link>
        </div>
        {collections.length === 0 ? (
          <Link
            href="/collections/new"
            className="card flex flex-col items-center gap-1 p-5 text-center"
          >
            <span className="text-sm font-semibold text-ink">맛집 리스트 만들기</span>
            <span className="text-[13px] text-ink-muted">
              “내 성수 맛집 10곳” 처럼 묶어서 자랑하고 공유하세요.
            </span>
          </Link>
        ) : (
          <div className="space-y-2">
            {collections.map((c) => (
              <Link key={c.id} href={`/collections/${c.id}`} className="card flex items-center gap-3 p-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-forest-soft text-forest">
                  {c.coverMedia ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.coverMedia} alt="" className="h-14 w-14 object-cover" />
                  ) : (
                    <Bookmark size={20} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 text-sm font-bold text-ink">
                    <span className="truncate">{c.title}</span>
                    {!c.isPublic && <Lock size={12} className="shrink-0 text-stone-400" />}
                  </div>
                  <div className="truncate text-[11px] text-stone-400">
                    맛집 {c.itemCount}곳
                    {c.previewNames.length > 0 && ` · ${c.previewNames.join(", ")}`}
                  </div>
                </div>
                <ChevronRight size={18} className="shrink-0 text-stone-300" />
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* 내가 등록한 맛집 */}
      <section className="mt-6">
        <h2 className="mb-2 text-sm font-bold text-ink">내가 등록한 맛집 ({myCards.length})</h2>
        {myCards.length === 0 ? (
          <Link href="/register" className="btn-primary w-full">
            첫 맛집 등록하기
          </Link>
        ) : (
          <div className="space-y-4">
            {myCards.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                liked={likedPosts.has(p.id)}
                saved={savedRestaurants.has(p.restaurantId)}
                isLoggedIn
              />
            ))}
          </div>
        )}
      </section>

      {/* 내가 저장한 맛집 */}
      {savedCards.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-bold text-neutral-700">저장한 맛집 ({savedCards.length})</h2>
          <div className="space-y-4">
            {savedCards.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                liked={likedPosts.has(p.id)}
                saved={savedRestaurants.has(p.restaurantId)}
                isLoggedIn
              />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
