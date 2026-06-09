import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { toPostCard, postCardSelect, getViewerReactions } from "@/server/restaurant/RestaurantService";
import PostCard from "@/components/PostCard";
import BackHomeHeader from "@/components/BackHomeHeader";

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
    <main className="px-5 py-6">
      <BackHomeHeader title={`저장한 맛집 (${cards.length})`} />
      {cards.length === 0 ? (
        <p className="mt-10 rounded-2xl bg-stone-50 py-12 text-center text-sm text-stone-400">
          아직 저장한 맛집이 없어요.
        </p>
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
