import { notFound } from "next/navigation";
import Link from "next/link";
import { Camera, MapPin, Share2, Check, Pencil } from "lucide-react";
import OfficialBadge from "@/components/OfficialBadge";
import Coachmark from "@/components/Coachmark";
import { prisma } from "@/lib/db";
import KakaoMap from "@/components/KakaoMap";
import ShareSheet from "@/components/ShareSheet";
import CopyAddressButton from "@/components/CopyAddressButton";
import CollectionPicker from "@/components/CollectionPicker";
import VerifyPanel from "@/components/VerifyPanel";
import Comments from "@/components/Comments";
import ReportButton from "@/components/ReportButton";
import BlockButton from "@/components/BlockButton";
import DeletePostButton from "@/components/DeletePostButton";
import DetailBackButton from "@/components/DetailBackButton";
import DetailMediaCarousel from "@/components/DetailMediaCarousel";
import StickyDetailHeader from "@/components/StickyDetailHeader";
import { getCurrentUser } from "@/lib/auth";
import LikeSaveButtons from "@/components/LikeSaveButtons";
import { reverseGeocode } from "@/server/place/PlaceSearchService";
import { getBlockedIds } from "@/server/block/BlockService";
import { getComments } from "@/server/comment/CommentService";
import { priceLabel, revisitLabel, waitingLabel } from "@/lib/labels";

export const dynamic = "force-dynamic";

function formatPostDate(value: Date) {
  return `${value.getFullYear()}.${String(value.getMonth() + 1).padStart(2, "0")}.${String(value.getDate()).padStart(2, "0")}`;
}

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  const user = await getCurrentUser();

  const post = await prisma.restaurantPost.findUnique({
    where: { id: postId },
    select: {
      id: true,
      userId: true,
      shortReview: true,
      content: true,
      tasteRating: true,
      tasteTags: true,
      serviceRating: true,
      serviceTags: true,
      atmosphereTags: true,
      priceRange: true,
      priceMemo: true,
      waitingLevel: true,
      revisitIntent: true,
      likeCount: true,
      saveCount: true,
      shareCount: true,
      commentCount: true,
      createdAt: true,
      locationVerified: true,
      receiptVerified: true,
      menuVerified: true,
      receiptPhotoUrl: true,
      menuPhotoUrl: true,
      user: { select: { nickname: true, totalLevel: true, isAdmin: true } },
      restaurant: {
        select: {
          id: true,
          name: true,
          address: true,
          latitude: true,
          longitude: true,
          saveCount: true,
          primaryRegion: { select: { name: true } },
          promotions: {
            where: { isAdLabeled: true },
            select: { id: true, title: true, content: true, promotionType: true },
          },
        },
      },
      media: { orderBy: { sortOrder: "asc" }, select: { type: true, url: true, thumbnailUrl: true, muted: true } },
      categories: { select: { category: { select: { name: true } } } },
    },
  });

  if (!post) notFound();

  // 차단한 사용자의 글은 직접 URL로도 보이지 않게
  if (user) {
    const blocked = await getBlockedIds(user.id);
    if (blocked.includes(post.userId)) notFound();
  }

  let liked = false;
  let saved = false;
  if (user) {
    const [l, s] = await Promise.all([
      prisma.like.findUnique({ where: { userId_postId: { userId: user.id, postId } } }),
      prisma.save.findUnique({
        where: { userId_restaurantId: { userId: user.id, restaurantId: post.restaurant.id } },
      }),
    ]);
    liked = !!l;
    saved = !!s;
  }

  const mapUrl = post.restaurant.latitude
    ? `https://map.kakao.com/link/map/${encodeURIComponent(post.restaurant.name)},${post.restaurant.latitude},${post.restaurant.longitude}`
    : `https://map.kakao.com/?q=${encodeURIComponent(post.restaurant.name + " " + (post.restaurant.address ?? ""))}`;

  // 표시 주소: 저장된 주소가 있으면 그대로 사용(빠름). 없을 때만 좌표로 역지오코딩 후
  // restaurant.address 에 캐시 → 다음 조회부턴 외부호출 없이 즉시.
  let displayAddress = post.restaurant.address ?? null;
  if (!displayAddress && post.restaurant.latitude != null && post.restaurant.longitude != null) {
    const geo = await reverseGeocode(post.restaurant.latitude, post.restaurant.longitude);
    if (geo) {
      displayAddress = geo;
      await prisma.restaurant
        .update({ where: { id: post.restaurant.id }, data: { address: geo } })
        .catch(() => {});
    }
  }

  const comments = await getComments(postId, user?.id ?? null);
  const firstImage = post.media.find((m) => m.type === "image")?.url ?? null;

  return (
    <main className="pb-6">
      <StickyDetailHeader name={post.restaurant.name} />
      {/* 미디어 — 뒤로가기 + 장수 표시 + 점 인디케이터 */}
      {post.media.length === 0 ? (
        <div className="mx-5 mt-4">
          <DetailBackButton />
        </div>
      ) : (
        <DetailMediaCarousel media={post.media} title={post.restaurant.name} />
      )}

      {post.media.length === 0 && (
        <div className="mx-5 mt-3 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <Camera size={16} className="text-forest" /> 아직 대표 사진이 없어요
          </p>
          <p className="mt-1 text-[13px] text-ink-muted">
            현장에서 사진을 추가하면 더 신뢰도 높은 기록이 됩니다.
          </p>
        </div>
      )}

      <div className="space-y-5 px-5 pt-5">
        {/* 가게 핵심 정보 */}
        <header>
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-2xl font-extrabold leading-tight text-ink">{post.restaurant.name}</h1>
            <span className="shrink-0 pt-1 text-sm text-neutral-400">{post.restaurant.primaryRegion.name}</span>
          </div>
          {/* 메타 — 운영자 · 인증 · 등록일 (작게) */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] text-stone-400">
            {post.user.isAdmin && (
              <>
                <span className="flex items-center gap-0.5 font-bold text-[#1d9bf0]">
                  <Check size={12} strokeWidth={3} /> 운영자
                </span>
                <span>·</span>
              </>
            )}
            {post.locationVerified && (
              <>
                <span className="flex items-center gap-0.5 font-bold text-forest">
                  <Check size={12} strokeWidth={3} /> 인증
                </span>
                <span>·</span>
              </>
            )}
            {post.receiptVerified && (
              <>
                <span className="font-semibold text-forest">영수증</span>
                <span>·</span>
              </>
            )}
            {post.menuVerified && (
              <>
                <span className="font-semibold text-forest">메뉴</span>
                <span>·</span>
              </>
            )}
            <span>{formatPostDate(post.createdAt)} 등록</span>
          </div>
          {/* 한줄평 */}
          {post.shortReview && (
            <p className="mt-3 line-clamp-2 text-base font-semibold text-ink">“{post.shortReview}”</p>
          )}
        </header>

        {/* 재방문 의사 — 평가 역할 (색강조). 한줄평 바로 밑. */}
        {post.revisitIntent && (() => {
          const positive = ["must", "nearby"].includes(post.revisitIntent);
          const negative = ["not_revisit", "pass"].includes(post.revisitIntent);
          const cls = positive
            ? "bg-forest-soft text-forest"
            : negative
              ? "bg-coral/10 text-coral-dark"
              : "bg-stone-100 text-stone-500";
          return (
            <span className={`inline-flex w-fit items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-bold ${cls}`}>
              {positive && "👍 "}
              {revisitLabel(post.revisitIntent)}
            </span>
          );
        })()}

        {/* 작성자 본인 — 방문 인증 CTA (미인증이면 크게, 인증 후엔 작게) */}
        {user?.id === post.userId && (
          <div className="relative">
            <Coachmark
              storageKey="mukgopin:coach-verify"
              enabled={!post.locationVerified}
              text="여기서 위치 인증하면 경험치가 들어와요! (가게 50m 이내에서)"
              position="absolute bottom-full right-0 mb-2 max-w-[260px]"
              arrow="down"
            />
            {post.locationVerified ? (
              <details className="overflow-hidden rounded-xl border border-stone-200">
                <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-[13px] font-bold text-forest">
                  <span className="flex items-center gap-1">
                    <Check size={14} strokeWidth={3} /> 방문 인증 완료
                  </span>
                  <span className="text-xs font-semibold text-stone-400">영수증·메뉴 추가</span>
                </summary>
                <div className="border-t border-stone-100">
                  <VerifyPanel
                    postId={post.id}
                    embedded
                    restaurant={{ name: post.restaurant.name, lat: post.restaurant.latitude, lng: post.restaurant.longitude }}
                    initial={{
                      locationVerified: post.locationVerified,
                      receiptAttached: !!post.receiptPhotoUrl,
                      menuAttached: !!post.menuPhotoUrl,
                    }}
                  />
                </div>
              </details>
            ) : (
              <details className="overflow-hidden rounded-2xl border-2 border-forest" open>
                <summary className="flex cursor-pointer list-none items-center justify-between bg-forest px-4 py-4 text-base font-extrabold text-white">
                  <span className="flex items-center gap-2">
                    <MapPin size={20} /> 방문 인증하고 XP 받기
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-white/85">지금 인증</span>
                </summary>
                <div className="border-t border-forest/20">
                  <VerifyPanel
                    postId={post.id}
                    embedded
                    restaurant={{ name: post.restaurant.name, lat: post.restaurant.latitude, lng: post.restaurant.longitude }}
                    initial={{
                      locationVerified: post.locationVerified,
                      receiptAttached: !!post.receiptPhotoUrl,
                      menuAttached: !!post.menuPhotoUrl,
                    }}
                  />
                </div>
              </details>
            )}
          </div>
        )}

        {/* 가게 정보 — 가격·웨이팅·분위기/상황 태그 (기본 접힘) */}
        {(post.priceRange || post.priceMemo || post.waitingLevel || post.categories.length > 0) && (
          <details className="card overflow-hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-extrabold text-ink">
              가게 정보
              <span className="text-xs font-semibold text-forest">열기</span>
            </summary>
            <div className="space-y-3 border-t border-stone-100 p-4">
              {(post.priceRange || post.priceMemo || post.waitingLevel) && (
                <div className="grid grid-cols-2 gap-2 text-center">
                  <Meta label="가격대" value={post.priceMemo || priceLabel(post.priceRange) || "-"} />
                  <Meta label="웨이팅" value={waitingLabel(post.waitingLevel) || "-"} />
                </div>
              )}
              {post.categories.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {post.categories.map((c) => (
                    <span key={c.category.name} className="chip-off">{c.category.name}</span>
                  ))}
                </div>
              )}
            </div>
          </details>
        )}

        {/* 주요 액션 — 한 줄 액션바 (저장/좋아요 + 지도/공유/리스트) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-2xl border border-stone-200 px-3 py-2.5">
            <span className="text-[12px] tabular-nums text-stone-400">
              좋아요 {post.likeCount} · 저장 {post.restaurant.saveCount} · 공유 {post.shareCount} · 💬 {post.commentCount}
            </span>
            <LikeSaveButtons
              postId={post.id}
              restaurantId={post.restaurant.id}
              initialLiked={liked}
              initialSaved={saved}
              initialLikeCount={post.likeCount}
              initialSaveCount={post.restaurant.saveCount}
              isLoggedIn={!!user}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <a href={mapUrl} target="_blank" rel="noreferrer" className="btn-outline h-10 !text-sm">
              <MapPin size={15} /> 지도
            </a>
            {post.locationVerified ? (
              <ShareSheet
                postId={post.id}
                restaurantName={post.restaurant.name}
                description={post.shortReview || `${post.restaurant.primaryRegion.name} 맛집`}
                imageUrl={firstImage}
              />
            ) : (
              <button type="button" disabled className="btn-outline h-10 !text-sm opacity-50">
                <Share2 size={15} /> 공유
              </button>
            )}
            <CollectionPicker restaurantId={post.restaurant.id} isLoggedIn={!!user} compact />
          </div>
          {!post.locationVerified && (
            <p className="flex items-center justify-center gap-1 text-center text-[11px] text-stone-400">
              <MapPin size={12} /> 위치 인증을 해야 공유할 수 있어요
            </p>
          )}
          <p className="text-[12px] text-stone-400">
            등록 by <b className="text-ink">{post.user.nickname}</b>
            {post.user.isAdmin && <OfficialBadge size={13} className="ml-0.5 inline-flex align-middle" />} · Lv.{post.user.totalLevel}
          </p>
        </div>

        {/* 작성자 관리 (본인만) — 수정 / 삭제 (방문 인증은 상단 CTA로 이동) */}
        {user?.id === post.userId && (
          <div className="space-y-2 rounded-2xl border border-stone-200 p-3">
            <p className="text-[12px] font-bold text-stone-400">내가 등록한 맛집</p>
            <div className="flex gap-2">
              <Link href={`/restaurants/${post.id}/edit`} className="btn-outline h-10 flex-1 !text-sm">
                <Pencil size={15} /> 수정
              </Link>
              <DeletePostButton postId={post.id} />
            </div>
          </div>
        )}

        {/* 비작성자 — 차단 / 신고 (+ 운영자 삭제) */}
        {user && user.id !== post.userId && (
          <div className="flex items-center justify-end gap-4 text-[13px]">
            <BlockButton userId={post.userId} nickname={post.user.nickname} />
            <ReportButton targetType="post" targetId={post.id} />
            {user.isAdmin && <DeletePostButton postId={post.id} adminLabel="운영자 삭제" />}
          </div>
        )}

        {/* 위치 — 지도 + 주소 (액션·관리 아래로) */}
        {post.restaurant.latitude != null && post.restaurant.longitude != null && (
          <section>
            <p className="mb-1.5 text-[13px] font-bold text-stone-500">위치</p>
            <KakaoMap
              center={{ lat: post.restaurant.latitude, lng: post.restaurant.longitude }}
              name={post.restaurant.name}
              height={160}
            />
            {displayAddress && (
              <div className="mt-2">
                <CopyAddressButton address={displayAddress} />
              </div>
            )}
          </section>
        )}

        {/* 사장님 홍보 영역 — 사용자 리뷰와 명확히 분리, 랭킹/XP 와 무관 */}
        {post.restaurant.promotions.length > 0 && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="mb-2 inline-block rounded-full bg-amber-400/90 px-2 py-0.5 text-[11px] font-bold text-white">
              광고 · 사장님 홍보
            </div>
            {post.restaurant.promotions.map((pr) => (
              <div key={pr.id} className="mt-1">
                <div className="text-sm font-bold">{pr.title}</div>
                {pr.content && <p className="text-sm text-neutral-600">{pr.content}</p>}
              </div>
            ))}
            <p className="mt-2 text-[11px] text-amber-700">
              ※ 사장님 홍보는 일반 랭킹·사용자 XP에 영향을 주지 않습니다.
            </p>
          </section>
        )}

        {/* 댓글 — 기본 접힘 (수 + 모두 보기) */}
        <details className="card overflow-hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-extrabold text-ink">
            댓글 {post.commentCount}개
            <span className="text-xs font-semibold text-forest">{post.commentCount > 0 ? "모두 보기" : "쓰기"}</span>
          </summary>
          <div className="border-t border-stone-100 p-4">
            <Comments
              postId={post.id}
              initial={comments}
              initialCount={post.commentCount}
              isLoggedIn={!!user}
              isPostAuthor={user?.id === post.userId}
            />
          </div>
        </details>
      </div>
    </main>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-2.5">
      <div className="text-[11px] text-neutral-400">{label}</div>
      <div className="mt-0.5 text-sm font-semibold">{value}</div>
    </div>
  );
}

