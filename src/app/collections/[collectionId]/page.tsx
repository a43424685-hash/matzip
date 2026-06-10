import Link from "next/link";
import { notFound } from "next/navigation";
import { Share2, MapPin, Lock, Coins } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getCollectionDetail, canSellPaidMaps } from "@/server/collection/CollectionService";
import { getBlockedIds } from "@/server/block/BlockService";
import PaidMapToggle from "@/components/PaidMapToggle";
import PurchaseMapButton from "@/components/PurchaseMapButton";
import PaidMapViewer from "@/components/PaidMapViewer";
import BackButton from "@/components/BackButton";

export const dynamic = "force-dynamic";

export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ collectionId: string }>;
}) {
  const { collectionId } = await params;
  const user = await getCurrentUser();
  const col = await getCollectionDetail(collectionId, user?.id ?? null);
  if (!col) notFound();

  const isOwner = user?.id === col.ownerId;
  // 비공개 컬렉션은 소유자만
  if (!col.isPublic && !isOwner) notFound();
  // 차단한 사용자의 컬렉션은 보이지 않게
  if (user && !isOwner) {
    const blocked = await getBlockedIds(user.id);
    if (blocked.includes(col.ownerId)) notFound();
  }

  const canSell = isOwner ? await canSellPaidMaps(col.ownerId) : false;

  return (
    <main className="pb-10">
      {/* 헤더 */}
      <header className="bg-forest px-5 pb-6 pt-3 text-white">
        <BackButton fallback="/" className="-ml-2 mb-1 text-white" />
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
          {col.isPaid && (
            <span className="flex items-center gap-0.5 rounded-md bg-coral px-1.5 py-0.5 text-[11px] font-extrabold text-white">
              <Coins size={11} /> 유료 {col.priceWon?.toLocaleString()}원
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

        {/* 유료 잠금: 지역별 개수만 보여주고 본문은 블러 */}
        {col.locked ? (
          <div className="mt-5">
            <div className="card p-5">
              <div className="flex items-center gap-1.5 text-sm font-extrabold text-ink">
                <Coins size={16} className="text-forest" /> 유료 맛집 지도
              </div>
              <p className="mt-1 text-[13px] text-ink-muted">
                구매하면 {col.itemCount}곳의 가게 이름·위치·후기·인증이 모두 열려요.
              </p>

              {/* 지역별 보유 개수 (구매 전 미리보기) */}
              <div className="mt-3 flex flex-wrap gap-2">
                {col.regionCounts.map((r) => (
                  <span
                    key={r.name}
                    className="rounded-lg bg-forest-soft/40 px-2.5 py-1 text-[13px] font-semibold text-forest"
                  >
                    {r.name} {r.count}곳
                  </span>
                ))}
              </div>

              {/* 가려진 목록 미리보기 */}
              <div className="relative mt-4 select-none">
                <div className="space-y-3 blur-[6px]">
                  {Array.from({ length: Math.min(col.itemCount, 4) }).map((_, i) => (
                    <div key={i} className="card flex items-center gap-3 p-3">
                      <span className="badge-rank bg-stone-100 text-stone-400">{i + 1}</span>
                      <div className="h-14 w-14 shrink-0 rounded-xl bg-stone-200" />
                      <div className="min-w-0 flex-1">
                        <div className="h-3.5 w-2/3 rounded bg-stone-200" />
                        <div className="mt-2 h-2.5 w-1/3 rounded bg-stone-100" />
                        <div className="mt-2 h-2.5 w-1/2 rounded bg-stone-100" />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="flex items-center gap-1.5 rounded-full bg-ink/80 px-3 py-1.5 text-[13px] font-bold text-white">
                    <Lock size={14} /> 구매 후 공개
                  </span>
                </div>
              </div>

              <div className="mt-4">
                <PurchaseMapButton collectionId={col.id} priceWon={col.priceWon} buyerId={user?.id ?? null} />
              </div>
            </div>
          </div>
        ) : col.items.length === 0 ? (
          <div className="card mt-5 p-6 text-center text-sm text-ink-muted">
            아직 담긴 맛집이 없어요.
            {isOwner && (
              <span className="mt-1 block text-[13px]">
                맛집 상세 페이지에서 <b className="text-forest">내 리스트에 담기</b>로 추가하세요.
              </span>
            )}
          </div>
        ) : (
          <PaidMapViewer
            collectionId={col.id}
            items={col.items}
            regionCounts={col.regionCounts}
            initialVisited={col.visitedIds}
            initialSaved={col.savedIds}
            canTrack={!!user}
          />
        )}

        {/* 소유자: 유료 판매 설정 */}
        {isOwner && (
          <PaidMapToggle
            collectionId={col.id}
            initialIsPaid={col.isPaid}
            initialPrice={col.priceWon}
            canSell={canSell}
          />
        )}
      </div>
    </main>
  );
}
