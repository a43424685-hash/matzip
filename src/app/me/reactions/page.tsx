import Link from "next/link";
import { redirect } from "next/navigation";
import { Heart, Bookmark } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import MeSubPageHeader from "@/components/MeSubPageHeader";

export const dynamic = "force-dynamic";

export default async function MyReactionsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [agg, top] = await Promise.all([
    prisma.restaurantPost.aggregate({
      where: { userId: user.id },
      _sum: { likeCount: true, saveCount: true },
    }),
    prisma.restaurantPost.findMany({
      where: { userId: user.id, OR: [{ likeCount: { gt: 0 } }, { saveCount: { gt: 0 } }] },
      orderBy: [{ likeCount: "desc" }, { saveCount: "desc" }],
      take: 20,
      select: {
        id: true,
        likeCount: true,
        saveCount: true,
        restaurant: { select: { name: true, primaryRegion: { select: { name: true } } } },
      },
    }),
  ]);
  const totalLikes = agg._sum.likeCount ?? 0;
  const totalSaves = agg._sum.saveCount ?? 0;

  return (
    <main className="px-5 pb-24 pt-5">
      <MeSubPageHeader title="받은 좋아요·저장" />

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-stone-200 p-4 text-center">
          <Heart size={20} className="mx-auto text-coral" />
          <div className="mt-1.5 text-2xl font-extrabold tabular-nums text-ink">{totalLikes}</div>
          <div className="text-[12px] text-stone-400">받은 좋아요</div>
        </div>
        <div className="rounded-2xl border border-stone-200 p-4 text-center">
          <Bookmark size={20} className="mx-auto text-forest" />
          <div className="mt-1.5 text-2xl font-extrabold tabular-nums text-ink">{totalSaves}</div>
          <div className="text-[12px] text-stone-400">받은 저장</div>
        </div>
      </div>

      <h2 className="mb-2 mt-7 text-sm font-bold text-stone-400">반응 많은 내 맛집</h2>
      {top.length === 0 ? (
        <p className="rounded-2xl bg-stone-50 py-10 text-center text-sm text-stone-400">
          아직 받은 반응이 없어요.
        </p>
      ) : (
        <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200/80">
          {top.map((p) => (
            <li key={p.id}>
              <Link href={`/restaurants/${p.id}`} className="flex items-center gap-3 bg-white px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-ink">{p.restaurant.name}</div>
                  <div className="truncate text-[12px] text-stone-400">{p.restaurant.primaryRegion.name}</div>
                </div>
                <span className="flex items-center gap-2.5 text-[12px] tabular-nums text-stone-400">
                  <span className="flex items-center gap-0.5"><Heart size={12} /> {p.likeCount}</span>
                  <span className="flex items-center gap-0.5"><Bookmark size={12} /> {p.saveCount}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
