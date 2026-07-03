"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Loader2 } from "lucide-react";
import type { PostCard } from "@/server/restaurant/RestaurantService";
import { PhotoCard, TextPostCard } from "@/components/FeedMiniCard";

const PAGE_SIZE = 20;

/**
 * 팔로잉 피드 — 팔로우한 사람들이 "인증한" 맛집만, 최신순, 2열 그리드.
 * 첫 20개는 서버에서 받고, "더보기"로 /api/feed/following?skip=N 로 이어붙인다.
 */
export default function FollowingFeed({ initialItems }: { initialItems: PostCard[] }) {
  const [items, setItems] = useState<PostCard[]>(initialItems);
  const [hasMore, setHasMore] = useState(initialItems.length === PAGE_SIZE);
  const [loading, setLoading] = useState(false);

  async function loadMore() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/feed/following?skip=${items.length}`);
      const data = await res.json();
      const next: PostCard[] = data.items ?? [];
      setItems((prev) => [...prev, ...next]);
      setHasMore(!!data.hasMore && next.length === PAGE_SIZE);
    } catch {
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="mx-5 mt-6 rounded-2xl bg-stone-50 px-6 py-12 text-center">
        <p className="text-[15px] font-bold text-ink">팔로우한 사람들의 맛집이 여기 모여요</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
          마음에 드는 미식가를 팔로우하면
          <br />
          그분들이 인증한 새 맛집이 최신순으로 떠요.
        </p>
        <Link
          href="/rankings"
          className="mt-4 inline-flex items-center gap-1 rounded-full bg-forest px-4 py-2 text-[13px] font-bold text-white"
        >
          맛잘알 랭킹에서 찾아보기 <ChevronRight size={15} />
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-5 px-5">
      <div className="grid grid-cols-2 gap-3">
        {items.map((p) =>
          p.media ? (
            <PhotoCard key={p.id} post={p} variant="grid" showVerified />
          ) : (
            <TextPostCard key={p.id} post={p} variant="grid" showVerified />
          )
        )}
      </div>
      {hasMore && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loading}
          className="mt-5 flex h-12 w-full items-center justify-center rounded-xl border border-stone-200 bg-white text-sm font-semibold text-ink active:scale-[0.99] disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="mr-1.5 animate-spin" /> 불러오는 중…
            </>
          ) : (
            "더보기"
          )}
        </button>
      )}
    </div>
  );
}
