"use client";

import Link from "next/link";
import { Bookmark, Heart, ShieldCheck, Play, Check, Star, Camera } from "lucide-react";
import CardImage from "@/components/CardImage";
import type { PostCard } from "@/server/restaurant/RestaurantService";

// 홈 가로스크롤(고정폭) + 팔로잉 2열 그리드(꽉찬폭) 공용 카드.
// variant="grid" 면 w-full(그리드 칸 채움), 아니면 w-[184px](가로스크롤).

function formatPostDate(value: Date | string) {
  const date = new Date(value);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

type Variant = "fixed" | "grid";
const widthCls = (v: Variant) => (v === "grid" ? "w-full" : "w-[184px] shrink-0");

export function PhotoCard({
  post,
  showVerified,
  variant = "fixed",
}: {
  post: PostCard;
  showVerified?: boolean;
  variant?: Variant;
}) {
  const isVideo = post.media?.type === "video";
  const img = post.media?.thumbnailUrl || (isVideo ? null : post.media?.url) || null;
  return (
    <Link
      href={`/restaurants/${post.id}`}
      className={`flex h-[238px] ${widthCls(variant)} flex-col rounded-2xl border border-stone-200 bg-white p-2`}
    >
      <div className="relative h-[132px] overflow-hidden rounded-xl bg-stone-100">
        {img ? (
          <CardImage src={img} alt={post.restaurantName} label="사진 준비 중" className="h-full w-full object-cover" />
        ) : isVideo ? (
          <div className="h-full w-full bg-stone-800" />
        ) : (
          <div className="thumb-empty h-full w-full" />
        )}
        {isVideo && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white">
              <Play size={16} fill="currentColor" />
            </span>
          </span>
        )}
        <div className="absolute left-2 top-2 flex gap-1">
          {post.isOfficial && (
            <span className="flex items-center gap-1 rounded-full bg-ink px-2 py-0.5 text-[11px] font-bold text-white">
              <Check size={11} strokeWidth={3.2} /> 운영자
            </span>
          )}
          {(showVerified || post.verification.location) && (
            <span className="flex items-center gap-1 rounded-full bg-forest/90 px-2 py-0.5 text-[11px] font-bold text-white">
              <ShieldCheck size={11} /> 인증
            </span>
          )}
        </div>
      </div>
      <div className="mt-2 line-clamp-2 min-h-[40px] text-sm font-bold leading-tight text-ink">{post.restaurantName}</div>
      <div className="truncate text-[12px] text-stone-400">{post.regionName}</div>
      <div className="truncate text-[11px] text-stone-400">{formatPostDate(post.createdAt)} 등록</div>
      <div className="mt-auto flex items-center gap-2.5 text-[11px] text-stone-400">
        <span className="flex items-center gap-0.5">
          <Bookmark size={11} /> {post.saveCount}
        </span>
        <span className="flex items-center gap-0.5">
          <Heart size={11} /> {post.likeCount}
        </span>
      </div>
    </Link>
  );
}

export function TextPostCard({
  post,
  showVerified,
  variant = "fixed",
}: {
  post: PostCard;
  showVerified?: boolean;
  variant?: Variant;
}) {
  // 운영자 PICK — 사진 없어도 "디자인 카드"로: 대표메뉴 히어로 + 별점 + 1호 사진 훅
  if (post.isOperatorPick) return <OperatorPickCard post={post} variant={variant} />;

  return (
    <Link
      href={`/restaurants/${post.id}`}
      className={`flex h-[238px] ${widthCls(variant)} flex-col rounded-2xl border border-stone-200 bg-white p-2`}
    >
      <div className="relative flex h-[132px] flex-col justify-between overflow-hidden rounded-xl bg-forest-soft p-3">
        <div className="absolute inset-0 opacity-60 thumb-empty" />
        <div className="relative z-[1] flex w-fit gap-1">
          {post.isOfficial && (
            <span className="inline-flex items-center gap-1 rounded-full bg-ink px-2 py-0.5 text-[11px] font-bold text-white">
              <Check size={11} strokeWidth={3.2} /> 운영자
            </span>
          )}
          {(showVerified || post.verification.location) && (
            <span className="inline-flex items-center gap-1 rounded-full bg-forest/90 px-2 py-0.5 text-[11px] font-bold text-white">
              <ShieldCheck size={11} /> 인증
            </span>
          )}
        </div>
        <div className="relative z-[1] mt-auto">
          <div className="text-[11px] font-bold text-forest">사진 준비 중</div>
          {post.shortReview && (
            <p className="mt-1 line-clamp-2 text-[12px] font-semibold leading-snug text-ink-muted">
              {post.shortReview}
            </p>
          )}
        </div>
      </div>
      <div className="mt-2 line-clamp-2 min-h-[40px] text-sm font-bold leading-tight text-ink">
        {post.restaurantName}
      </div>
      <div className="truncate text-[12px] text-stone-400">{post.regionName}</div>
      <div className="truncate text-[11px] text-stone-400">{formatPostDate(post.createdAt)} 등록</div>
      <div className="mt-auto flex items-center gap-2.5 text-[11px] text-stone-400">
        <span className="flex items-center gap-0.5">
          <Bookmark size={11} /> {post.saveCount}
        </span>
        <span className="flex items-center gap-0.5">
          <Heart size={11} /> {post.likeCount}
        </span>
      </div>
    </Link>
  );
}

// 운영자 PICK 전용 카드 — 대표메뉴를 주인공으로, 별점·리뷰(다이닝코드) 크게,
// 빈 사진칸은 "1호 사진 올리기" 참여 훅으로 전환. (외부 사진 저장 안 함 = 저작권 안전)
export function OperatorPickCard({ post, variant = "fixed" }: { post: PostCard; variant?: Variant }) {
  const hero = post.signatureMenu ?? post.categories[0] ?? "가보고 싶은 곳";
  const rating = post.extRating;
  const reviews = post.extReviewCount;
  return (
    <Link
      href={`/restaurants/${post.id}`}
      className={`flex h-[238px] ${widthCls(variant)} flex-col rounded-2xl border border-amber-200/80 bg-white p-2`}
    >
      <div className="relative flex h-[132px] flex-col justify-between overflow-hidden rounded-xl bg-gradient-to-br from-amber-500 via-orange-500 to-orange-700 p-3">
        <div className="flex items-start justify-between">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-extrabold text-orange-700">
            <Star size={11} strokeWidth={3} fill="currentColor" /> 운영자 PICK
          </span>
          {rating != null && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-black/30 px-1.5 py-0.5 text-[12px] font-extrabold text-white backdrop-blur-sm">
              <Star size={10} fill="currentColor" strokeWidth={0} /> {rating.toFixed(1)}
            </span>
          )}
        </div>
        <div>
          <div className="line-clamp-2 text-[19px] font-black leading-[1.15] text-white drop-shadow-sm">
            {hero}
          </div>
          {reviews != null && reviews > 0 && (
            <div className="mt-0.5 text-[10.5px] font-semibold text-white/85">
              리뷰 {reviews.toLocaleString()} · 다이닝코드
            </div>
          )}
        </div>
      </div>
      <div className="mt-2 line-clamp-1 text-sm font-bold text-ink">{post.restaurantName}</div>
      <div className="truncate text-[12px] text-stone-400">{post.regionName}</div>
      {post.shortReview ? (
        <p className="mt-1 line-clamp-1 text-[12px] font-semibold text-ink-muted">{post.shortReview}</p>
      ) : null}
      <div className="mt-auto flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] font-extrabold text-orange-700">
        <Camera size={12} /> 1호 사진 올리고 +50 XP
      </div>
    </Link>
  );
}
