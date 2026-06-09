import Link from "next/link";
import { MapPin } from "lucide-react";
import type { PostCard as PostCardData } from "@/server/restaurant/RestaurantService";
import { priceLabel } from "@/lib/labels";
import LikeSaveButtons from "./LikeSaveButtons";
import CardImage from "./CardImage";
import VerificationBadges from "./VerificationBadges";
import { isVerified } from "@/lib/verification";

function formatPostDate(value: Date | string) {
  const date = new Date(value);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

export default function PostCard({
  post,
  liked,
  saved,
  isLoggedIn,
}: {
  post: PostCardData;
  liked: boolean;
  saved: boolean;
  isLoggedIn: boolean;
}) {
  const tags = post.categories.slice(0, 3);

  // 사진 없는 카드 = 이미지 영역 없는 텍스트 리스트 카드 (작게)
  if (!post.media) {
    return (
      <article className="card px-4 py-3.5">
        <Header post={post} />
        {post.shortReview && (
          <p className="mt-1 line-clamp-1 text-sm text-ink-muted">{post.shortReview}</p>
        )}
        <Tags tags={tags} priceRange={post.priceRange} />
        {isVerified(post.verification) && (
          <div className="mt-2">
            <VerificationBadges v={post.verification} compact />
          </div>
        )}
        <Footer post={post} liked={liked} saved={saved} isLoggedIn={isLoggedIn} />
      </article>
    );
  }

  // 사진/영상 있는 카드 = 큰 이미지 카드 (시원하게)
  return (
    <article className="card overflow-hidden">
      <Link href={`/restaurants/${post.id}`} className="block">
        {post.media.type === "video" ? (
          <video
            src={post.media.url}
            poster={post.media.thumbnailUrl ?? undefined}
            className="aspect-[4/3] w-full bg-stone-900 object-cover"
            muted
            playsInline
          />
        ) : (
          <CardImage
            src={post.media.url}
            alt={post.restaurantName}
            label="사진 준비 중"
            className="aspect-[4/3] w-full bg-stone-100 object-cover"
          />
        )}
      </Link>
      <div className="p-4">
        <Header post={post} />
        {post.shortReview && (
          <p className="mt-1.5 line-clamp-2 text-[15px] text-ink-muted">{post.shortReview}</p>
        )}
        <Tags tags={tags} priceRange={post.priceRange} />
        {isVerified(post.verification) && (
          <div className="mt-2">
            <VerificationBadges v={post.verification} compact />
          </div>
        )}
        <Footer post={post} liked={liked} saved={saved} isLoggedIn={isLoggedIn} />
      </div>
    </article>
  );
}

function Header({ post }: { post: PostCardData }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <Link
        href={`/restaurants/${post.id}`}
        className="truncate text-base font-bold text-ink"
      >
        {post.restaurantName}
      </Link>
      <span className="flex shrink-0 items-center gap-0.5 text-[13px] text-stone-400">
        <MapPin size={13} /> {post.regionName}
      </span>
    </div>
  );
}

function Tags({ tags, priceRange }: { tags: string[]; priceRange: string | null }) {
  if (tags.length === 0 && !priceRange) return null;
  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      {tags.map((c) => (
        <span
          key={c}
          className="rounded-md bg-forest-soft px-2 py-0.5 text-xs font-medium text-forest"
        >
          {c}
        </span>
      ))}
      {priceRange && (
        <span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-ink-muted">
          {priceLabel(priceRange)}
        </span>
      )}
    </div>
  );
}

function Footer({
  post,
  liked,
  saved,
  isLoggedIn,
}: {
  post: PostCardData;
  liked: boolean;
  saved: boolean;
  isLoggedIn: boolean;
}) {
  return (
    <div className="mt-3.5 flex items-center justify-between">
      <span className="flex items-center gap-1.5 text-xs text-stone-400">
        <span className="badge-lv">Lv.{post.authorLevel}</span>
        {post.authorNickname}
        <span>· {formatPostDate(post.createdAt)} 등록</span>
      </span>
      <LikeSaveButtons
        postId={post.id}
        restaurantId={post.restaurantId}
        initialLiked={liked}
        initialSaved={saved}
        initialLikeCount={post.likeCount}
        initialSaveCount={post.saveCount}
        isLoggedIn={isLoggedIn}
      />
    </div>
  );
}
