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
 *  - 추가로 불러온 글의 좋아요/저장 상태도 API 응답(liked/saved)으로 반영된다.
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
  // 좋아요/저장 상태 — 첫 페이지는 서버 렌더 값, 이후 페이지는 API 응답에서 누적
  const [likedSet, setLikedSet] = useState<Set<string>>(() => new Set(initialLiked));
  const [savedSet, setSavedSet] = useState<Set<string>>(() => new Set(initialSaved));

  async function loadMore() {
    if (loading) return;
    setLoading(true);
    try {
      const params = new URLSearchParams(query);
      // 다중 카테고리 필터 복원 (2페이지부터 필터가 풀리던 문제)
      const csv = params.get("categoryIdsCsv");
      if (csv) {
        params.delete("categoryIdsCsv");
        csv.split(",").forEach((id) => params.append("categoryIds", id));
      }
      params.set("skip", String(items.length));
      const res = await fetch(`/api/posts/feed?${params.toString()}`);
      if (!res.ok) throw new Error("feed");
      const data = await res.json();
      const next: PostCardData[] = data.items ?? [];
      // 오프셋 페이지네이션 특성상 새 글 유입 시 중복이 올 수 있어 id로 걸러낸다
      setItems((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...next.filter((n) => !seen.has(n.id))];
      });
      if (Array.isArray(data.liked) && data.liked.length) {
        setLikedSet((s) => new Set([...s, ...data.liked]));
      }
      if (Array.isArray(data.saved) && data.saved.length) {
        setSavedSet((s) => new Set([...s, ...data.saved]));
      }
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
