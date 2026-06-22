import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Lock, ChevronRight, Bookmark } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getMyCollectionsWithPreview } from "@/server/collection/CollectionService";
import MeSubPageHeader from "@/components/MeSubPageHeader";
import EmptyState from "@/components/EmptyState";

export const dynamic = "force-dynamic";

export default async function MyCollectionsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const collections = await getMyCollectionsWithPreview(user.id);

  return (
    <main className="px-5 pb-24 pt-5">
      <MeSubPageHeader title={`맛집 리스트 (${collections.length})`} />

      <Link
        href="/collections/new"
        className="mb-4 flex h-12 items-center justify-center gap-1 rounded-2xl bg-forest text-sm font-bold text-white active:scale-[0.99]"
      >
        <Plus size={17} /> 새 리스트 만들기
      </Link>

      {collections.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="아직 만든 리스트가 없어요"
          description="“내 성수 맛집 10곳”처럼 묶어서 모으고 공유해보세요."
        />
      ) : (
        <div className="space-y-2">
          {collections.map((c) => (
            <Link key={c.id} href={`/collections/${c.id}`} className="card flex items-center gap-3 p-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-forest-soft text-forest">
                {c.coverMedia ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.coverMedia} alt="" loading="lazy" decoding="async" className="h-14 w-14 object-cover" />
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
    </main>
  );
}
