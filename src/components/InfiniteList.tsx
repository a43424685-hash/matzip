"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { PostCard as PostCardData } from "@/server/restaurant/RestaurantService";
import PostCard from "./PostCard";

const PAGE_SIZE = 20;

/**
 * 맛집 전체 리스트 + "더보기" 오프셋 페이지네이션.
 *  - 첫 페이지는 서버에서 받아 초기 렌더(initialItems + initialLiked/initialSaved).
 *  - "더보기" 클릭 시 /api/posts/feed?...&skip=현재개수 로 다음 20개를 받아 이어붙인다.
 *  - hasMore=false 거나 20개 미만이 오면 버튼 숨김.
 *  - 추가로 불러온 글의 좋아요/저장 초기상태는 false(버튼이 클릭 시 자체 처리).
 */
export default function InfiniteList({
  initialItems,
  query,
  initialLiked,
  initialSaved,
  isLoggedIn = false,
}: {
  initialItems: PostCardData[];
  query: Record<string, string>;
  initialLiked: string[];
  initialSaved: string[];
  isLoggedIn?: boolean;
}) {
  const [items, setItems] = useState<PostCardData[]>(initialItems);
  const [hasMore, setHasMore] = useState(initialItems.length === PAGE_SIZE);
  const [loading, setLoading] = useState(false);

  // 첫 페이지 글에 대해서만 서버가 준 좋아요/저장 상태를 사용
  const likedSet = new Set(initialLiked);
  const savedSet = new Set(initialSaved);

  async function loadMore() {
    if (loading) return;
    setLoading(true);
    try {
      const params = new URLSearchParams(query);
      params.set("skip", String(items.length));
      const res = await fetch(`/api/posts/feed?${params.toString()}`);
      const data = await res.json();
      const next: PostCardData[] = data.items ?? [];
      setItems((prev) => [...prev, ...next]);
      // 응답이 20개 미만이면 더 없음
      setHasMore(!!data.hasMore && next.length === PAGE_SIZE);
    } catch {
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="space-y-4">
        {items.map((p) => (
          <PostCard
            key={p.id}
            post={p}
            liked={likedSet.has(p.id)}
            saved={savedSet.has(p.restaurantId)}
            isLoggedIn={isLoggedIn}
          />
        ))}
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
