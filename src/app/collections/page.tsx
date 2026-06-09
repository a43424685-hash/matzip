import Link from "next/link";
import { ListChecks } from "lucide-react";
import { getPublicCollections } from "@/server/home";
import { getCurrentUser } from "@/lib/auth";
import { getBlockedIds } from "@/server/block/BlockService";
import CardImage from "@/components/CardImage";
import BackHomeHeader from "@/components/BackHomeHeader";

export const dynamic = "force-dynamic";

export default async function PublicCollectionsPage() {
  const user = await getCurrentUser();
  const collections = await getPublicCollections(50, await getBlockedIds(user?.id ?? null));

  return (
    <main className="px-5 pb-24 pt-5">
      <BackHomeHeader title="추천 맛집 리스트" />
      {collections.length === 0 ? (
        <p className="mt-10 rounded-2xl bg-stone-50 py-12 text-center text-sm text-stone-400">
          아직 공개된 리스트가 없어요.
        </p>
      ) : (
        <div className="space-y-2">
          {collections.map((c) => (
            <Link key={c.id} href={`/collections/${c.id}`} className="card flex items-center gap-3 p-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-forest-soft text-forest">
                {c.coverUrl ? (
                  <CardImage src={c.coverUrl} alt={c.title} className="h-14 w-14 object-cover" />
                ) : (
                  <ListChecks size={20} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-ink">{c.title}</div>
                <div className="truncate text-[12px] text-stone-400">
                  {c.authorNickname} · Lv.{c.authorLevel} · 맛집 {c.itemCount}곳
                </div>
                {c.previewNames.length > 0 && (
                  <div className="truncate text-[11px] text-stone-400">{c.previewNames.join(" · ")}</div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
