"use client";

import Link from "next/link";
import { Bookmark, Heart, ShieldCheck, Play, Check, Star } from "lucide-react";
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
            <span className="flex items-center gap-1 rounded-full bg-[#1d9bf0] px-2 py-0.5 text-[11px] font-bold text-white">
              <Check size={11} strokeWidth={3.2} /> 운영자
            </span>
          )}
          {(showVerified || post.verification.location) && (
            <span className="flex items-center gap-1 rounded-full bg-forest/90 px-2 py-0.5 text-[11px] font-bold text-white">
              <ShieldCheck size={11} /> 인증
            </span>
          )}
          {!post.isOfficial && !post.verification.location && !showVerified && (
            <span className="rounded-full bg-stone-500/80 px-2 py-0.5 text-[11px] font-bold text-white">미인증</span>
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
  const isPick = post.isOperatorPick;
  return (
    <Link
      href={`/restaurants/${post.id}`}
      className={`flex h-[238px] ${widthCls(variant)} flex-col rounded-2xl border border-stone-200 bg-white p-2`}
    >
      <div className={`relative flex h-[132px] flex-col justify-between overflow-hidden rounded-xl p-3 ${isPick ? "bg-amber-100" : "bg-forest-soft"}`}>
        <div className="absolute inset-0 opacity-60 thumb-empty" />
        <div className="relative z-[1] flex w-fit gap-1">
          {isPick ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white">
              <Star size={11} strokeWidth={3} /> 운영자 PICK
            </span>
          ) : (
            <>
              {post.isOfficial && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#1d9bf0] px-2 py-0.5 text-[11px] font-bold text-white">
                  <Check size={11} strokeWidth={3.2} /> 운영자
                </span>
              )}
              {(showVerified || post.verification.location) && (
                <span className="inline-flex items-center gap-1 rounded-full bg-forest/90 px-2 py-0.5 text-[11px] font-bold text-white">
                  <ShieldCheck size={11} /> 인증
                </span>
              )}
              {!post.isOfficial && !post.verification.location && !showVerified && (
                <span className="inline-flex rounded-full bg-stone-500/80 px-2 py-0.5 text-[11px] font-bold text-white">미인증</span>
              )}
            </>
          )}
        </div>
        <div className="relative z-[1] mt-auto">
          <div className={`text-[11px] font-bold ${isPick ? "text-amber-700" : "text-forest"}`}>
            {isPick ? (post.categories[0] ?? "가보고 싶은 곳") : "사진 준비 중"}
          </div>
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
