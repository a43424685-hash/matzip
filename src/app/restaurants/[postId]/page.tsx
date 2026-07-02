import { notFound } from "next/navigation";
import Link from "next/link";
import { Camera, Share2, Check, Pencil, Star, Wallet, Clock, MessageCircle, Plus, MapPin } from "lucide-react";
import OfficialBadge from "@/components/OfficialBadge";
import PickCoachmark from "@/components/PickCoachmark";
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
import DetailOverflowMenu from "@/components/DetailOverflowMenu";
import StickyDetailHeader from "@/components/StickyDetailHeader";
import { getCurrentUser } from "@/lib/auth";
import LikeSaveButtons from "@/components/LikeSaveButtons";
import { reverseGeocode } from "@/server/place/PlaceSearchService";
import { getBlockedIds } from "@/server/block/BlockService";
import { canViewPost } from "@/server/visibility/PaidVisibility";
import { getComments } from "@/server/comment/CommentService";
import { priceLabel, revisitLabel, waitingLabel } from "@/lib/labels";

export const dynamic = "force-dynamic";

const MENU_ROW = "flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13.5px] font-medium text-ink hover:bg-stone-50";

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
      isOperatorPick: true,
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

  // 유료 잠금 글은 소유자/구매자/관리자만 (직접 URL 접근 차단)
  if (!(await canViewPost(user?.id ?? null, post.id))) notFound();

  // 차단한 사용자의 글은 직접 URL로도 안 보이게. 단, 운영자(admin)는 신고 처리/검수 위해 볼 수 있음.
  if (user && !user.isAdmin) {
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
  // Apple 지도(네이티브) 열기 옵션 — App Store 가이드라인 4 준수
  const appleMapUrl = post.restaurant.latitude
    ? `https://maps.apple.com/?ll=${post.restaurant.latitude},${post.restaurant.longitude}&q=${encodeURIComponent(post.restaurant.name)}`
    : `https://maps.apple.com/?q=${encodeURIComponent(post.restaurant.name + " " + (post.restaurant.address ?? ""))}`;

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
  const isAuthor = user?.id === post.userId;
  const hasCoords = post.restaurant.latitude != null && post.restaurant.longitude != null;
  // 사진이 없으면 지도를 히어로로 (PICK처럼 사진 없는 장소도 "어디인지"는 보이게)
  const heroIsMap = post.media.length === 0 && hasCoords;

  // 결정 정보
  const priceText = post.priceMemo || priceLabel(post.priceRange) || null;
  const waitingText = waitingLabel(post.waitingLevel) || null;
  const revisit = post.revisitIntent;
  const revisitPositive = revisit ? ["must", "nearby"].includes(revisit) : false;
  const revisitNegative = revisit ? ["not_revisit", "pass"].includes(revisit) : false;

  // 더보기(⋯) 메뉴 항목 — 역할별. 파괴적/저빈도 액션을 본문에서 분리.
  const menuItems = isAuthor ? (
    <>
      <Link href={`/restaurants/${post.id}/edit`} className={MENU_ROW}>
        <Pencil size={15} /> 수정
      </Link>
      <div className="flex px-4 py-2.5">
        <DeletePostButton postId={post.id} />
      </div>
    </>
  ) : user ? (
    <>
      <ReportButton targetType="post" targetId={post.id} className={MENU_ROW} />
      <BlockButton userId={post.userId} nickname={post.user.nickname} className={MENU_ROW} />
      {user.isAdmin && (
        <div className="flex border-t border-stone-100 px-4 py-2.5">
          <DeletePostButton postId={post.id} adminLabel="운영자 삭제" />
        </div>
      )}
    </>
  ) : null;

  return (
    <main className="pb-10">
      {post.isOperatorPick && <PickCoachmark postId={postId} />}
      <StickyDetailHeader name={post.restaurant.name} />

      {/* 히어로 — 사진 있으면 캐러셀, 없으면 지도. 좌표도 없으면 헤더 줄만. */}
      {post.media.length > 0 ? (
        <DetailMediaCarousel
          media={post.media}
          title={post.restaurant.name}
          topRight={menuItems ? <DetailOverflowMenu floating>{menuItems}</DetailOverflowMenu> : null}
        />
      ) : heroIsMap ? (
        <div className="relative">
          <KakaoMap
            center={{ lat: post.restaurant.latitude!, lng: post.restaurant.longitude! }}
            name={post.restaurant.name}
            height={240}
          />
          <DetailBackButton floating />
          {menuItems && <DetailOverflowMenu floating>{menuItems}</DetailOverflowMenu>}
        </div>
      ) : (
        <div className="mx-5 mt-4 flex items-center justify-between">
          <DetailBackButton />
          {menuItems && <DetailOverflowMenu>{menuItems}</DetailOverflowMenu>}
        </div>
      )}

      {post.media.length === 0 && (
        <div className="mx-5 mt-3 rounded-2xl bg-amber-50 px-4 py-3">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-amber-800">
            <Camera size={15} /> 아직 사진이 없어요 — 첫 방문자가 채워주세요!
          </p>
        </div>
      )}

      <div className="space-y-6 px-5 pt-5">
        {/* 제목 · 뱃지 · 한줄평 */}
        <header>
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-[23px] font-extrabold leading-tight text-ink">{post.restaurant.name}</h1>
            <span className="shrink-0 pt-1.5 text-[13px] text-stone-400">{post.restaurant.primaryRegion.name}</span>
          </div>
          {/* 뱃지 — 절제(채움 색은 PICK만) */}
          <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px]">
            {post.isOperatorPick && (
              <span className="inline-flex items-center gap-1 rounded-full bg-forest px-2 py-0.5 font-bold text-white">
                <Star size={11} strokeWidth={3} /> 운영자 PICK
              </span>
            )}
            {!post.isOperatorPick && post.locationVerified && (
              <span className="inline-flex items-center gap-1 font-bold text-forest">
                <Check size={13} strokeWidth={3} /> 인증
              </span>
            )}
            {!post.isOperatorPick && post.user.isAdmin && (
              <span className="font-semibold text-stone-400">운영자</span>
            )}
            {post.receiptVerified && <span className="text-stone-400">영수증</span>}
            {post.menuVerified && <span className="text-stone-400">메뉴</span>}
          </div>
          {post.shortReview && (
            <p className="mt-3 text-[17px] font-semibold leading-relaxed text-ink">{post.shortReview}</p>
          )}
        </header>

        {/* 결정 요약 — 재방문의사 · 가격 · 웨이팅 + 태그 */}
        {(revisit || priceText || waitingText || post.categories.length > 0) && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13.5px]">
              {revisit && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[13px] font-bold ${
                    revisitPositive
                      ? "bg-forest-soft text-forest"
                      : revisitNegative
                        ? "bg-coral/10 text-coral-dark"
                        : "bg-stone-100 text-stone-500"
                  }`}
                >
                  {revisitPositive && "👍 "}
                  {revisitLabel(revisit)}
                </span>
              )}
              {priceText && (
                <span className="flex items-center gap-1 text-ink-muted">
                  <Wallet size={14} /> {priceText}
                </span>
              )}
              {waitingText && (
                <span className="flex items-center gap-1 text-ink-muted">
                  <Clock size={14} /> 웨이팅 {waitingText}
                </span>
              )}
            </div>
            {post.categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {post.categories.map((c) => (
                  <span key={c.category.name} className="chip-off">{c.category.name}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* "내 맛집으로 등록" — 남의 글이거나 운영자 PICK이면 노출(PICK은 운영자가 작성자라 !isAuthor로는 안 뜸) */}
        {user && (post.isOperatorPick || !isAuthor) && (
          <Link
            href={`/register?add=${post.restaurant.id}`}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-forest text-[15px] font-bold text-white active:scale-[0.99]"
          >
            <Plus size={18} strokeWidth={2.5} /> 내 맛집으로 등록
          </Link>
        )}

        {/* 작성자 본인 — 방문 인증 CTA */}
        {isAuthor && (
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
                    <Check size={20} /> 방문 인증하고 XP 받기
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

        {/* 통합 액션 바 — 좋아요·저장·공유·리스트 + 댓글 수 (테두리 없이 한 줄) */}
        <div>
          <div className="flex items-center gap-2 border-y border-stone-100 py-3">
            <LikeSaveButtons
              postId={post.id}
              restaurantId={post.restaurant.id}
              initialLiked={liked}
              initialSaved={saved}
              initialLikeCount={post.likeCount}
              initialSaveCount={post.restaurant.saveCount}
              isLoggedIn={!!user}
            />
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
            <a href="#comments" className="ml-auto flex items-center gap-1.5 text-[13px] text-stone-400">
              <MessageCircle size={16} /> {post.commentCount}
            </a>
          </div>
          {!post.locationVerified && (
            <p className="mt-2 flex items-center justify-center gap-1 text-center text-[11px] text-stone-400">
              위치 인증을 해야 공유할 수 있어요
            </p>
          )}
        </div>

        {/* 위치 */}
        {post.restaurant.latitude != null && post.restaurant.longitude != null && (
          <section>
            <p className="mb-2 text-[13px] font-bold text-stone-500">위치</p>
            {!heroIsMap && (
              <KakaoMap
                center={{ lat: post.restaurant.latitude, lng: post.restaurant.longitude }}
                name={post.restaurant.name}
                height={160}
              />
            )}
            {displayAddress && (
              <div className="mt-2">
                <CopyAddressButton address={displayAddress} />
              </div>
            )}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <a href={appleMapUrl} target="_blank" rel="noreferrer" className="btn-outline h-10 !text-sm">
                <MapPin size={15} /> Apple 지도
              </a>
              <a href={mapUrl} target="_blank" rel="noreferrer" className="btn-outline h-10 !text-sm">
                <MapPin size={15} /> 카카오 지도
              </a>
            </div>
          </section>
        )}

        {/* 사장님 홍보 — 이질 콘텐츠라 카드 유지 */}
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

        {/* 댓글 — 접힘, 개수 노출 */}
        <details id="comments" className="border-t border-stone-100 pt-4">
          <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-extrabold text-ink">
            댓글 {post.commentCount}개
            <span className="text-xs font-semibold text-forest">{post.commentCount > 0 ? "모두 보기" : "쓰기"}</span>
          </summary>
          <div className="pt-4">
            <Comments
              postId={post.id}
              initial={comments}
              initialCount={post.commentCount}
              isLoggedIn={!!user}
              isPostAuthor={isAuthor}
            />
          </div>
        </details>

        {/* 작성자 · 등록일 — 최하단 회색 캡션 */}
        <p className="border-t border-stone-100 pt-4 text-[12px] text-stone-400">
          등록 <b className="text-stone-500">{post.user.nickname}</b>
          {post.user.isAdmin && <OfficialBadge size={12} className="ml-0.5 inline-flex align-middle" />} · Lv.{post.user.totalLevel} · {formatPostDate(post.createdAt)}
        </p>
      </div>
    </main>
  );
}
