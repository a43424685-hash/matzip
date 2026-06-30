import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { toPostCard, postCardSelect, getViewerReactions } from "@/server/restaurant/RestaurantService";
import { getTopRankerIds } from "@/server/ranking/RankingService";
import PostCard from "@/components/PostCard";
import BackHomeHeader from "@/components/BackHomeHeader";
import EmptyState from "@/components/EmptyState";

export const dynamic = "force-dynamic";

export default async function FollowingFeedPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // 내가 팔로우한 사람들의 id
  const followRows = await prisma.follow.findMany({
    where: { followerId: user.id },
    select: { followingId: true },
  });
  const followingIds = followRows.map((r) => r.followingId);

  // 팔로우한 사람들의 공개 글 — 최신순
  const rows = followingIds.length
    ? await prisma.restaurantPost.findMany({
        where: { userId: { in: followingIds }, visibility: "public" },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: postCardSelect,
      })
    : [];
  const cards = rows.map(toPostCard);

  const { likedPosts, savedRestaurants } = await getViewerReactions(
    user.id,
    cards.map((p) => p.id),
    cards.map((p) => p.restaurantId)
  );
  const topRankers = await getTopRankerIds();

  return (
    <main className="px-5 pb-24 pt-5">
      <BackHomeHeader title="팔로잉 피드" />
      {cards.length === 0 ? (
        <EmptyState
          icon={Users}
          title="아직 팔로우한 사람이 없어요"
          description="마음에 드는 미식가의 프로필에서 팔로우하면, 그분들의 새 맛집이 여기 모여요."
        />
      ) : (
        <div className="space-y-4">
          {cards.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              liked={likedPosts.has(p.id)}
              saved={savedRestaurants.has(p.restaurantId)}
              isLoggedIn
              authorIsRanker={topRankers.has(p.authorId)}
            />
          ))}
        </div>
      )}
    </main>
  );
}
