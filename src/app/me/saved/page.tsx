import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Bookmark } from "lucide-react";
import { toPostCard, postCardSelect, getViewerReactions } from "@/server/restaurant/RestaurantService";
import PostCard from "@/components/PostCard";
import MeSubPageHeader from "@/components/MeSubPageHeader";
import EmptyState from "@/components/EmptyState";

export const dynamic = "force-dynamic";

export default async function MySavedPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const rows = await prisma.save.findMany({
    where: { userId: user.id, postId: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { post: { select: postCardSelect } },
  });
  const cards = rows
    .map((s) => s.post)
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map(toPostCard);
  const { likedPosts, savedRestaurants } = await getViewerReactions(
    user.id,
    cards.map((p) => p.id),
    cards.map((p) => p.restaurantId)
  );

  return (
    <main className="px-5 pb-24 pt-5">
      <MeSubPageHeader title={`저장한 맛집 (${cards.length})`} />
      {cards.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="아직 저장한 맛집이 없어요"
          description="마음에 드는 맛집을 저장해 나만의 목록을 모아보세요."
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
            />
          ))}
        </div>
      )}
    </main>
  );
}
