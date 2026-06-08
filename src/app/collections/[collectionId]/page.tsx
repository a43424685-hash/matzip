import Link from "next/link";
import { notFound } from "next/navigation";
import { Share2, MapPin, Store, Lock } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getCollectionDetail } from "@/server/collection/CollectionService";
import CardImage from "@/components/CardImage";
import VerificationBadges from "@/components/VerificationBadges";

export const dynamic = "force-dynamic";

export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ collectionId: string }>;
}) {
  const { collectionId } = await params;
  const [user, col] = await Promise.all([
    getCurrentUser(),
    getCollectionDetail(collectionId),
  ]);
  if (!col) notFound();

  const isOwner = user?.id === col.ownerId;
  // 비공개 컬렉션은 소유자만
  if (!col.isPublic && !isOwner) notFound();

  return (
    <main className="pb-10">
      {/* 헤더 */}
      <header className="bg-forest px-5 pb-6 pt-5 text-white">
        <div className="flex items-center gap-2 text-[13px] text-white/70">
          {col.regionName && (
            <span className="flex items-center gap-0.5">
              <MapPin size={13} /> {col.regionName}
            </span>
          )}
          {!col.isPublic && (
            <span className="flex items-center gap-0.5">
              <Lock size={12} /> 비공개
            </span>
          )}
        </div>
        <h1 className="mt-1.5 text-2xl font-black tracking-tight">{col.title}</h1>
        {col.description && (
          <p className="mt-2 text-sm text-white/85">{col.description}</p>
        )}
        <div className="mt-3 flex items-center gap-2 text-[13px]">
          <span className="rounded-md bg-coral px-1.5 py-0.5 text-[11px] font-extrabold">
            Lv.{col.ownerLevel}
          </span>
          <span className="font-semibold">{col.ownerNickname}</span>
          <span className="text-white/60">· 맛집 {col.itemCount}곳</span>
        </div>
      </header>

      <div className="px-5 pt-4">
        <Link href={`/collections/${col.id}/share`} className="btn-primary h-12 w-full !text-base">
          <Share2 size={18} /> 이 리스트 공유하기
        </Link>

        {/* 맛집 목록 */}
        <div className="mt-5 space-y-3">
          {col.items.length === 0 ? (
            <div className="card p-6 text-center text-sm text-ink-muted">
              아직 담긴 맛집이 없어요.
              {isOwner && (
                <span className="mt-1 block text-[13px]">
                  맛집 상세 페이지에서 <b className="text-forest">내 리스트에 담기</b>로 추가하세요.
                </span>
              )}
            </div>
          ) : (
            col.items.map((it, i) => {
              const href = it.postId ? `/restaurants/${it.postId}` : "#";
              return (
                <Link
                  key={it.restaurantId}
                  href={href}
                  className="card flex items-center gap-3 p-3"
                >
                  <span className="badge-rank bg-stone-100 text-stone-500">{i + 1}</span>
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                    {it.media && it.media.type === "image" ? (
                      <CardImage
                        src={it.media.url}
                        alt={it.restaurantName}
                        className="h-14 w-14 object-cover"
                      />
                    ) : (
                      <div className="thumb-empty flex h-14 w-14 items-center justify-center text-forest/40">
                        <Store size={20} strokeWidth={1.7} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-ink">{it.restaurantName}</div>
                    <div className="text-[11px] text-stone-400">
                      {it.regionName}
                      {it.categories.length > 0 && ` · ${it.categories.slice(0, 2).join(", ")}`}
                    </div>
                    {it.shortReview && (
                      <p className="mt-0.5 line-clamp-1 text-[13px] text-ink-muted">
                        {it.shortReview}
                      </p>
                    )}
                    <div className="mt-1">
                      <VerificationBadges v={it.verification} compact />
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}
