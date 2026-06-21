import Link from "next/link";
import { notFound } from "next/navigation";
import { Share2, MapPin, Lock, Coins, Eye } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getCollectionDetail, canSellPaidMaps, PAID_MAP_PREVIEW_COUNT } from "@/server/collection/CollectionService";
import { getBlockedIds } from "@/server/block/BlockService";
import PaidMapToggle from "@/components/PaidMapToggle";
import PreviewPicker from "@/components/PreviewPicker";
import PurchaseMapButton from "@/components/PurchaseMapButton";
import PaidMapViewer from "@/components/PaidMapViewer";
import BackButton from "@/components/BackButton";
import OfficialBadge from "@/components/OfficialBadge";

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
          {col.ownerIsAdmin && <OfficialBadge size={15} />}
          <span className="text-white/60">· 맛집 {col.itemCount}곳</span>
        </div>
      </header>

      <div className="px-5 pt-4">
        <Link href={`/collections/${col.id}/share`} className="btn-primary h-12 w-full !text-base">
          <Share2 size={18} /> 이 리스트 공유하기
        </Link>

        {/* 유료 잠금: 맛보기(무료 공개)만 실제로 보여주고 나머지는 잠금 */}
        {col.locked ? (
          <div className="mt-5 space-y-4">
            <div className="card p-5">
              <div className="flex items-center gap-1.5 text-sm font-extrabold text-ink">
                <Coins size={16} className="text-forest" /> 유료 맛집 지도
              </div>
              <p className="mt-1 text-[13px] text-ink-muted">
                맛보기 {col.items.length}곳을 먼저 둘러보고, 구매하면 총 {col.itemCount}곳이 모두 열려요.
              </p>
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
            </div>

            {/* 맛보기 무료 공개 가게 (실제 노출) */}
            {col.items.length > 0 && (
              <div>
                <p className="mb-2 flex items-center gap-1 text-sm font-extrabold text-ink">
                  <Eye size={15} className="text-forest" /> 맛보기 무료 공개 {col.items.length}곳
                </p>
                <div className="space-y-2">
                  {col.items.map((it) => (
                    <Link
                      key={it.restaurantId}
                      href={it.postId ? `/restaurants/${it.postId}` : `/collections/${col.id}`}
                      className="card flex items-center gap-3 p-3"
                    >
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-stone-100">
                        {it.media?.url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={it.media.url} alt="" className="h-14 w-14 object-cover" />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold text-ink">{it.restaurantName}</div>
                        <div className="truncate text-[12px] text-stone-400">{it.regionName}</div>
                        {it.shortReview && (
                          <div className="mt-0.5 truncate text-[12px] text-ink-muted">{it.shortReview}</div>
                        )}
                      </div>
                      <span className="shrink-0 rounded-md bg-forest-soft px-1.5 py-0.5 text-[10px] font-bold text-forest">
                        맛보기
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* 잠긴 나머지 */}
            {col.itemCount - col.items.length > 0 && (
              <div className="relative select-none">
                <div className="space-y-3 blur-[6px]">
                  {Array.from({ length: Math.min(col.itemCount - col.items.length, 3) }).map((_, i) => (
                    <div key={i} className="card flex items-center gap-3 p-3">
                      <div className="h-14 w-14 shrink-0 rounded-xl bg-stone-200" />
                      <div className="min-w-0 flex-1">
                        <div className="h-3.5 w-2/3 rounded bg-stone-200" />
                        <div className="mt-2 h-2.5 w-1/3 rounded bg-stone-100" />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="flex items-center gap-1.5 rounded-full bg-ink/80 px-3 py-1.5 text-[13px] font-bold text-white">
                    <Lock size={14} /> 나머지 {col.itemCount - col.items.length}곳 구매 후 공개
                  </span>
                </div>
              </div>
            )}

            <PurchaseMapButton collectionId={col.id} priceWon={col.priceWon} buyerId={user?.id ?? null} />
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

        {/* 소유자: 맛보기 선택 + 유료 판매 설정 */}
        {isOwner && (
          <>
            {col.items.length > 0 && (
              <PreviewPicker
                collectionId={col.id}
                need={PAID_MAP_PREVIEW_COUNT}
                items={col.items.map((i) => ({
                  restaurantId: i.restaurantId,
                  restaurantName: i.restaurantName,
                  isPreview: i.isPreview,
                }))}
              />
            )}
            <PaidMapToggle
              collectionId={col.id}
              initialIsPaid={col.isPaid}
              initialPrice={col.priceWon}
              canSell={canSell}
            />
          </>
        )}
      </div>
    </main>
  );
}
