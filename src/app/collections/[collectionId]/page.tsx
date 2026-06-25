import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Share2, MapPin, Lock, Coins, Eye, ShieldCheck, Trophy } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getMyOverallRank } from "@/server/ranking/RankingService";
import MapTeaser from "@/components/MapTeaser";
import PaymentReturnHandler from "@/components/PaymentReturnHandler";
import UnlockCelebration from "@/components/UnlockCelebration";
import {
  getCollectionDetail,
  canSellPaidMaps,
  getMyRestaurantsForPicker,
  PAID_MAP_PREVIEW_COUNT,
} from "@/server/collection/CollectionService";
import { getBlockedIds } from "@/server/block/BlockService";
import PaidMapToggle from "@/components/PaidMapToggle";
import PreviewPicker from "@/components/PreviewPicker";
import CollectionAddPicker from "@/components/CollectionAddPicker";
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
  const addableRestaurants = isOwner ? await getMyRestaurantsForPicker(col.ownerId, col.id) : [];
  const ownerRank = await getMyOverallRank(col.ownerId);
  const ownerIsRanker = ownerRank > 0 && ownerRank <= 30;

  return (
    <main className="pb-10">
      {/* 헤더 */}
      <header className="px-5 pb-2 pt-3">
        <div className="mb-2 flex items-center justify-between">
          <BackButton fallback="/" className="-ml-2 text-ink" />
          <Link href={`/collections/${col.id}/share`} aria-label="공유" className="flex h-9 w-9 items-center justify-center rounded-full text-stone-500 active:scale-95">
            <Share2 size={20} />
          </Link>
        </div>
        <div className="flex items-center gap-2 text-[13px] text-ink-muted">
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
        <h1 className="mt-1.5 text-xl font-black tracking-tight text-ink">{col.title}</h1>
      </header>

      <Suspense fallback={null}>
        <PaymentReturnHandler collectionId={col.id} />
      </Suspense>
      {col.purchased && <UnlockCelebration collectionId={col.id} title={col.title} count={col.itemCount} />}

      <div className="px-5 pt-4">
        {/* 가치 배너 — 판매자 신뢰(데이터) + 인증 집계 (유료·열람 가능 시) */}
        {col.isPaid && !col.locked && (
          <div className="mt-4 rounded-2xl border border-forest/20 bg-forest-soft/25 p-4">
            <p className="flex items-start gap-1.5 text-[13px] font-extrabold text-ink">
              <ShieldCheck size={15} className="mt-0.5 shrink-0 text-forest" />
              <span>
                {col.ownerIsAdmin
                  ? "운영자가 직접 인증한"
                  : `Lv.${col.ownerLevel} · 인증 맛집 ${col.ownerVerifiedTotal}곳의 로컬 ${col.ownerNickname}님이 직접 인증한`}{" "}
                {col.itemCount}곳
              </span>
            </p>
            <p className="mt-1 pl-5 text-[12px] text-ink-muted">
              위치 인증 {col.verifyStats.location}/{col.verifyStats.total}
              {col.verifyStats.proof > 0 && ` · 영수증·메뉴 인증 ${col.verifyStats.proof}/${col.verifyStats.total}`}
            </p>
          </div>
        )}

        {/* 유료 잠금: 맛보기(무료 공개)만 실제로 보여주고 나머지는 잠금 */}
        {col.locked ? (
          <div className="mt-2 space-y-4">
            {/* 지도 티저 — 가치를 한눈에 (제일 위 비주얼) */}
            {col.mapPins.length > 0 && <MapTeaser pins={col.mapPins} />}

            {/* 크리에이터 — 담백한 한 줄 */}
            <div className="flex flex-wrap items-center gap-1.5 px-1 text-[13px]">
              {ownerIsRanker && <span className="leading-none">👑</span>}
              {ownerRank > 0 && (
                <span className="flex items-center gap-0.5 rounded bg-amber-100 px-1 py-0.5 text-[11px] font-extrabold text-amber-700">
                  <Trophy size={10} /> 전체 {ownerRank}위
                </span>
              )}
              <span className="font-bold text-ink">{col.ownerNickname}</span>
              {col.ownerIsAdmin && <OfficialBadge size={14} />}
              <span className="text-ink-muted">Lv.{col.ownerLevel} · 인증 {col.ownerVerifiedTotal}곳 · 맛집 {col.itemCount}곳</span>
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
                          <img
                            src={it.media.thumbnailUrl ?? it.media.url}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="h-14 w-14 object-cover"
                          />
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

            {/* 잠긴 맛집 티저 — 흐릿한 실제 사진 + 잠금 개수(호기심) */}
            {col.lockedTeasers.length > 0 && (
              <div>
                <p className="mb-2 flex items-center gap-1 text-sm font-extrabold text-ink">
                  <Lock size={14} className="text-ink-muted" /> 잠긴 맛집 {col.lockedTeasers.length}곳
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {col.lockedTeasers.slice(0, 9).map((t, i) => (
                    <div key={i} className="relative aspect-square overflow-hidden rounded-xl bg-stone-200">
                      {t.media?.url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={t.media.thumbnailUrl ?? t.media.url}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full scale-110 object-cover blur-[5px]"
                        />
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <Lock size={16} className="text-white/90" />
                      </div>
                    </div>
                  ))}
                </div>
                {col.lockedTeasers.length > 9 && (
                  <p className="mt-2 text-center text-[12px] font-semibold text-ink-muted">+{col.lockedTeasers.length - 9}곳 더 구매 시 공개</p>
                )}
              </div>
            )}

            <PurchaseMapButton collectionId={col.id} priceWon={col.priceWon} buyerId={user?.id ?? null} />
          </div>
        ) : col.items.length === 0 ? (
          <div className="card mt-5 p-6 text-center text-sm text-ink-muted">
            아직 담긴 맛집이 없어요.
            {isOwner && (
              <span className="mt-1 block text-[13px]">
                아래 <b className="text-forest">내 맛집에서 담기</b>로 등록·저장한 맛집을 골라 담거나,
                맛집 상세의 <b className="text-forest">리스트</b> 버튼으로 추가하세요.
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
            isOwner={isOwner}
          />
        )}

        {/* 소유자: 내 맛집 담기 + 맛보기 선택 + 유료 판매 설정 */}
        {isOwner && (
          <>
            <CollectionAddPicker collectionId={col.id} restaurants={addableRestaurants} paidMap={col.isPaid} />
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
