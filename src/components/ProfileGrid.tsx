"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import CardImage from "@/components/CardImage";
import type { GridItem, ProfileGridTab } from "@/server/profile/ProfileGridService";

const PAGE = 30;

/** 프로필 사진 그리드 + 무한 스크롤. 첫 페이지는 서버에서 받고, 이후는 API로. */
export default function ProfileGrid({
  userId,
  tab,
  initial,
}: {
  userId: string;
  tab: ProfileGridTab;
  initial: GridItem[];
}) {
  const [items, setItems] = useState<GridItem[]>(initial);
  const [hasMore, setHasMore] = useState(initial.length === PAGE);
  const [loading, setLoading] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  // 탭 전환(서버 재렌더) 시 초기화
  useEffect(() => {
    setItems(initial);
    setHasMore(initial.length === PAGE);
  }, [initial, tab]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/profile/posts?userId=${userId}&tab=${tab}&skip=${items.length}`);
      if (res.ok) {
        const d = await res.json();
        setItems((prev) => [...prev, ...d.items]);
        setHasMore(d.hasMore);
      } else {
        setHasMore(false);
      }
    } catch {
      setHasMore(false);
    }
    setLoading(false);
  }, [loading, hasMore, userId, tab, items.length]);

  useEffect(() => {
    if (!hasMore) return;
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "500px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadMore]);

  return (
    <>
      <div className="grid grid-cols-3 gap-0.5 p-0.5">
        {items.map((p) => (
          <Link key={p.id} href={`/restaurants/${p.id}`} className="relative aspect-square overflow-hidden bg-stone-100">
            {p.thumb ? (
              <CardImage src={p.thumb} alt={p.name} label="" className="h-full w-full object-cover" />
            ) : (
              <div className={`flex h-full w-full flex-col justify-end p-2 ${p.pick ? "bg-amber-100" : "bg-forest-soft/60"}`}>
                {p.pick && <span className="mb-auto text-[9px] font-extrabold text-amber-600">⭐ PICK</span>}
                <span className="line-clamp-3 text-[11px] font-bold leading-tight text-ink">{p.name}</span>
              </div>
            )}
            {p.verified && (
              <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-forest/90 text-white">
                <ShieldCheck size={11} />
              </span>
            )}
            {p.thumb && (
              <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/60 to-transparent px-1.5 pb-1 pt-4 text-[10px] font-semibold text-white">
                {p.name}
              </span>
            )}
          </Link>
        ))}
      </div>
      {hasMore && (
        <div ref={sentinel} className="py-6 text-center text-[13px] text-stone-400">
          {loading ? "불러오는 중…" : ""}
        </div>
      )}
    </>
  );
}
