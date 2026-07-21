import Link from "next/link";
import { Store, ShieldCheck, Check, Play, Star } from "lucide-react";
import type { PostCard } from "@/server/restaurant/RestaurantService";
import CardImage from "./CardImage";
import OfficialBadge from "./OfficialBadge";

/** 목록(더보기) 한 줄: 사진 · 업체명 · 닉네임 · 지역 (+ 인증/운영자 마크) */
export default function FeedListItem({ post }: { post: PostCard }) {
  const isVideo = post.media?.type === "video";
  const img = post.media?.thumbnailUrl || (isVideo ? null : post.media?.url) || null;
  return (
    <Link href={`/restaurants/${post.id}`} className="card flex items-center gap-3 p-3">
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-stone-100">
        {img ? (
          <CardImage src={img} alt={post.restaurantName} className="h-16 w-16 object-cover" />
        ) : (
          <div className="thumb-empty flex h-16 w-16 items-center justify-center text-forest/40">
            <Store size={20} strokeWidth={1.7} />
          </div>
        )}
        {isVideo && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white">
              <Play size={13} fill="currentColor" />
            </span>
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-bold text-ink">{post.restaurantName}</span>
          {post.isOperatorPick ? (
            <span className="flex shrink-0 items-center gap-0.5 rounded-md bg-amber-500 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
              <Star size={10} strokeWidth={3} /> 운영자 PICK
            </span>
          ) : (
            <>
              {post.isOfficial && (
                <span className="flex shrink-0 items-center gap-0.5 rounded-md bg-ink px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                  <Check size={10} strokeWidth={3.5} /> 운영자
                </span>
              )}
              {post.verification.location && (
                <span className="flex shrink-0 items-center gap-0.5 rounded-md bg-forest px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                  <ShieldCheck size={10} /> 인증
                </span>
              )}
            </>
          )}
        </div>
        {post.isOperatorPick ? (
          <>
            {post.signatureMenu && (
              <div className="mt-0.5 truncate text-[12.5px] font-bold text-forest">{post.signatureMenu}</div>
            )}
            <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-stone-400">
              {post.extRating != null && (
                <span className="flex items-center gap-0.5 font-bold text-amber-500">
                  <Star size={11} fill="currentColor" strokeWidth={0} /> {post.extRating.toFixed(1)}
                </span>
              )}
              {post.extReviewCount != null && post.extReviewCount > 0 && <span>리뷰 {post.extReviewCount}</span>}
              <span className="truncate">· {post.regionName}</span>
            </div>
          </>
        ) : (
          <>
            <div className="mt-0.5 text-[12px] text-stone-400">{post.regionName}</div>
            <div className="mt-0.5 flex items-center gap-1 text-[12px] text-ink-muted">
              {post.authorNickname}
              {post.isOfficial && <OfficialBadge size={12} />}
            </div>
          </>
        )}
      </div>
    </Link>
  );
}
