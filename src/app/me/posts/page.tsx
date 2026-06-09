import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { toPostCard, postCardSelect, getViewerReactions } from "@/server/restaurant/RestaurantService";
import PostCard from "@/components/PostCard";
import MeSubPageHeader from "@/components/MeSubPageHeader";

export const dynamic = "force-dynamic";

export default async function MyPostsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const rows = await prisma.restaurantPost.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: postCardSelect,
  });
  const cards = rows.map(toPostCard);
  const { likedPosts, savedRestaurants } = await getViewerReactions(
    user.id,
    cards.map((p) => p.id),
    cards.map((p) => p.restaurantId)
  );

  return (
    <main className="px-5 pb-24 pt-5">
      <MeSubPageHeader title={`내 등록 맛집 (${cards.length})`} />
      {cards.length === 0 ? (
        <div className="mt-10 text-center">
          <p className="mb-4 text-sm text-stone-400">아직 등록한 맛집이 없어요.</p>
          <Link href="/register" className="btn-primary w-full">
            첫 맛집 등록하기
          </Link>
        </div>
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
