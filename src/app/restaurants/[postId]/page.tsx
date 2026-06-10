import { notFound } from "next/navigation";
import { Camera, MapPin, Share2, Check } from "lucide-react";
import OfficialBadge from "@/components/OfficialBadge";
import { prisma } from "@/lib/db";
import KakaoMap from "@/components/KakaoMap";
import ShareButton from "@/components/ShareButton";
import CopyAddressButton from "@/components/CopyAddressButton";
import CollectionPicker from "@/components/CollectionPicker";
import VerificationBadges from "@/components/VerificationBadges";
import VerifyPanel from "@/components/VerifyPanel";
import Comments from "@/components/Comments";
import ReportButton from "@/components/ReportButton";
import BlockButton from "@/components/BlockButton";
import DeletePostButton from "@/components/DeletePostButton";
import DetailBackButton from "@/components/DetailBackButton";
import DetailMediaCarousel from "@/components/DetailMediaCarousel";
import { getCurrentUser } from "@/lib/auth";
import LikeSaveButtons from "@/components/LikeSaveButtons";
import { reverseGeocode } from "@/server/place/PlaceSearchService";
import { getBlockedIds } from "@/server/block/BlockService";
import { getComments } from "@/server/comment/CommentService";
import {
  ATMOSPHERE_TAGS,
  SERVICE_TAGS,
  TASTE_TAGS,
  labelMany,
  priceLabel,
  revisitLabel,
  serviceRatingLabel,
  tasteRatingLabel,
  waitingLabel,
} from "@/lib/labels";

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

  return (
    <main className="pb-6">
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
        <header>
          <div className="flex items-center justify-between">
            <h1 className="flex items-center gap-2 text-2xl font-extrabold">
              {post.user.isAdmin && (
                <span className="flex items-center gap-0.5 rounded-md bg-[#1d9bf0] px-1.5 py-0.5 text-[12px] font-extrabold text-white">
                  <Check size={12} strokeWidth={3.5} /> 운영자
                </span>
              )}
              {post.restaurant.name}
            </h1>
            <span className="text-sm text-neutral-400">{post.restaurant.primaryRegion.name}</span>
          </div>
          <p className="mt-1 text-[13px] text-stone-400">{formatPostDate(post.createdAt)} 등록</p>
        </header>

        {/* 지도 — 좌표가 있을 때만 */}
        {post.restaurant.latitude != null && post.restaurant.longitude != null && (
          <KakaoMap
            center={{ lat: post.restaurant.latitude, lng: post.restaurant.longitude }}
            name={post.restaurant.name}
            height={200}
          />
        )}

        {/* 지도 밑 — 정확한 주소(역지오코딩) + 탭하면 복사 */}
        {displayAddress && <CopyAddressButton address={displayAddress} />}

        {/* 카테고리 */}
        {post.categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {post.categories.map((c) => (
              <span key={c.category.name} className="chip-off">
                {c.category.name}
              </span>
            ))}
          </div>
        )}

        {/* 방문 인증 — 이 유저의 기록 기준 (음식점 자체가 아님) */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-stone-400">방문 인증</span>
          <VerificationBadges
            v={{
              location: post.locationVerified,
              receipt: post.receiptVerified,
              menu: post.menuVerified,
            }}
            showUnverified
          />
        </div>

        {/* 한줄평/리뷰 */}
        {post.shortReview && <p className="text-base font-semibold">“{post.shortReview}”</p>}
        {post.content && <p className="whitespace-pre-line text-sm text-neutral-600">{post.content}</p>}

        {(post.tasteRating || post.tasteTags.length > 0 || post.serviceRating || post.serviceTags.length > 0 || post.atmosphereTags.length > 0) && (
          <section className="space-y-3 rounded-2xl bg-stone-50 p-4">
            <ReviewTags
              title="맛"
              primary={tasteRatingLabel(post.tasteRating)}
              tags={labelMany(post.tasteTags, TASTE_TAGS)}
            />
            <ReviewTags
              title="서비스"
              primary={serviceRatingLabel(post.serviceRating)}
              tags={labelMany(post.serviceTags, SERVICE_TAGS)}
            />
            <ReviewTags
              title="분위기"
              tags={labelMany(post.atmosphereTags, ATMOSPHERE_TAGS)}
            />
          </section>
        )}

        {/* 메타 */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <Meta label="가격대" value={post.priceMemo || priceLabel(post.priceRange) || "-"} />
          <Meta label="웨이팅" value={waitingLabel(post.waitingLevel) || "-"} />
          <Meta label="재방문" value={revisitLabel(post.revisitIntent) || "-"} />
        </div>

        {/* 반응 */}
        <div className="card flex items-center justify-between p-3.5">
          <div className="text-xs tabular-nums text-ink-muted">
            좋아요 {post.likeCount} · 저장 {post.restaurant.saveCount} · 공유 {post.shareCount} · 💬 {post.commentCount}
          </div>
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

        {/* 작성자 + 지도 */}
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1 text-ink-muted">
            등록 by <b className="text-ink">{post.user.nickname}</b>
            {post.user.isAdmin && <OfficialBadge size={15} />} · Lv.{post.user.totalLevel}
          </span>
          <a
            href={mapUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 font-semibold text-forest"
          >
            <MapPin size={15} /> 지도 열기
          </a>
        </div>

        {/* 신고 / 삭제 (작성자 본인 또는 운영자) */}
        {user && (
          <div className="flex items-center justify-end gap-4 text-[13px]">
            {user.id !== post.userId && (
              <BlockButton userId={post.userId} nickname={post.user.nickname} />
            )}
            {user.id !== post.userId && <ReportButton targetType="post" targetId={post.id} />}
            {(user.id === post.userId || user.isAdmin) && (
              <DeletePostButton
                postId={post.id}
                adminLabel={user.id === post.userId ? undefined : "운영자 삭제"}
              />
            )}
          </div>
        )}

        {/* 방문 인증하기 — 본인 기록만, 기본 접기 */}
        {user?.id === post.userId && (
          <details className="card overflow-hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-extrabold text-ink">
              방문 인증하기
              <span className="text-xs font-semibold text-forest">열기</span>
            </summary>
            <div className="border-t border-stone-100">
              <VerifyPanel
                postId={post.id}
                embedded
                restaurant={{
                  name: post.restaurant.name,
                  lat: post.restaurant.latitude,
                  lng: post.restaurant.longitude,
                }}
                initial={{
                  locationVerified: post.locationVerified,
                  receiptAttached: !!post.receiptPhotoUrl,
                  menuAttached: !!post.menuPhotoUrl,
                }}
              />
            </div>
          </details>
        )}

        {/* 리스트 담기 + 공유 */}
        <CollectionPicker restaurantId={post.restaurant.id} isLoggedIn={!!user} />
        {post.locationVerified ? (
          <ShareButton postId={post.id} />
        ) : (
          <div>
            <button
              type="button"
              disabled
              className="btn-outline h-12 w-full !text-base opacity-50"
            >
              <Share2 size={18} /> 이 맛집 공유하기
            </button>
            <p className="mt-1.5 flex items-center justify-center gap-1 text-center text-[12px] text-stone-400">
              <MapPin size={13} /> 위치 인증을 해야 공유할 수 있어요
            </p>
          </div>
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

        {/* 댓글 */}
        <Comments
          postId={post.id}
          initial={comments}
          initialCount={post.commentCount}
          isLoggedIn={!!user}
          isPostAuthor={user?.id === post.userId}
        />
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

function ReviewTags({ title, primary, tags }: { title: string; primary?: string; tags?: string[] }) {
  const all = [primary, ...(tags ?? [])].filter(Boolean) as string[];
  if (all.length === 0) return null;
  return (
    <div>
      <div className="mb-1.5 text-[12px] font-bold text-stone-500">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {all.map((label) => (
          <span key={label} className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-ink">
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
