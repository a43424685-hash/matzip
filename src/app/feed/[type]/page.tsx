import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getActiveRegions } from "@/server/catalog";
import { getBlockedIds } from "@/server/block/BlockService";
import { searchPosts, type SortKey } from "@/server/restaurant/RestaurantService";
import FeedControls from "@/components/FeedControls";
import FeedListItem from "@/components/FeedListItem";

export const dynamic = "force-dynamic";

const TYPES: Record<string, { title: string; sub: string; includeUnverified: boolean; defaultSort: string }> = {
  weekly: { title: "이번 주 인기 맛집", sub: "사람들이 많이 저장한 곳", includeUnverified: false, defaultSort: "popular" },
  recent: { title: "갓 올라온 맛집", sub: "방금 등록된 따끈한 맛집", includeUnverified: true, defaultSort: "recent" },
};
const SORT_MAP: Record<string, SortKey> = { popular: "saves", recent: "latest", name: "name" };

export default async function FeedPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ sort?: string; regionId?: string }>;
}) {
  const { type } = await params;
  const cfg = TYPES[type];
  if (!cfg) notFound();
  const sp = await searchParams;
  const sortUi = sp.sort && SORT_MAP[sp.sort] ? sp.sort : cfg.defaultSort;
  const regionId = sp.regionId || null;

  const user = await getCurrentUser();
  const blocked = await getBlockedIds(user?.id ?? null);
  const [regions, posts] = await Promise.all([
    getActiveRegions(),
    searchPosts({
      sort: SORT_MAP[sortUi],
      regionId,
      includeUnverified: cfg.includeUnverified,
      excludeUserIds: blocked,
      limit: 60,
    }),
  ]);

  return (
    <main className="pb-10">
      <header className="sticky top-0 z-10 flex items-center gap-1 border-b border-stone-100 bg-white/95 px-3 py-3 backdrop-blur">
        <Link href="/" aria-label="홈으로" className="flex h-9 w-9 items-center justify-center rounded-full text-ink active:scale-95">
          <ChevronLeft size={24} strokeWidth={2.4} />
        </Link>
        <h1 className="text-[16px] font-extrabold text-ink">{cfg.title}</h1>
      </header>

      <div className="px-5">
        <FeedControls regions={regions} sort={sortUi} regionId={regionId} />

        {posts.length === 0 ? (
          <p className="mt-6 rounded-2xl bg-stone-50 py-12 text-center text-sm text-stone-400">
            {regionId ? "이 지역엔 아직 맛집이 없어요." : "아직 등록된 맛집이 없어요."}
          </p>
        ) : (
          <div className="space-y-2.5">
            {posts.map((p) => (
              <FeedListItem key={p.id} post={p} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
