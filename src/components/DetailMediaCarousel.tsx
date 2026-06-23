"use client";

import { useRef, useState } from "react";
import CardImage from "@/components/CardImage";
import DetailBackButton from "@/components/DetailBackButton";

type MediaItem = {
  type: string;
  url: string;
  thumbnailUrl: string | null;
  muted: boolean;
};

export default function DetailMediaCarousel({
  media,
  title,
}: {
  media: MediaItem[];
  title: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  function onScroll() {
    const el = scrollerRef.current;
    if (!el) return;
    const next = Math.round(el.scrollLeft / el.clientWidth);
    setActive(Math.min(Math.max(next, 0), media.length - 1));
  }

  return (
    {/* 위로 당겨 상태바 밑까지 사진을 꽉 채움(풀-블리드) — app-shell의 상단 안전영역 여백 상쇄 */}
    <section className="relative bg-stone-900 mt-[calc(env(safe-area-inset-top)_*_-1)]">
      <DetailBackButton floating />

      {media.length > 1 && (
        <div className="absolute right-3 top-[calc(env(safe-area-inset-top)_+_0.75rem)] z-10 rounded-full bg-black/50 px-2.5 py-1 text-xs font-bold text-white backdrop-blur">
          {active + 1} / {media.length}
        </div>
      )}

      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
      >
        {media.map((m, i) =>
          m.type === "video" ? (
            <video
              key={`${m.url}-${i}`}
              src={m.url}
              poster={m.thumbnailUrl ?? undefined}
              controls
              playsInline
              muted={m.muted}
              className="aspect-[4/3] w-full shrink-0 snap-center object-cover"
            />
          ) : (
            <CardImage
              key={`${m.url}-${i}`}
              src={m.url}
              alt={title}
              label="사진 준비 중"
              className="aspect-[4/3] w-full shrink-0 snap-center object-cover"
            />
          )
        )}
      </div>

      {media.length > 1 && (
        <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
          {media.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === active ? "w-5 bg-white" : "w-1.5 bg-white/45"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
