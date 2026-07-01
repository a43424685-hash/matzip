"use client";

import { useEffect, useRef, useState } from "react";
import { MoreVertical } from "lucide-react";

/**
 * 상세 페이지 우측 상단 더보기(⋯) 메뉴.
 * 신고·차단·수정·삭제 같은 저빈도/파괴적 액션을 본문에서 빼내 여기로 모은다.
 * children = 메뉴 항목(역할에 따라 서버에서 구성해 전달).
 */
export default function DetailOverflowMenu({
  children,
  floating = false,
}: {
  children: React.ReactNode;
  floating?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div
      ref={ref}
      className={floating ? "absolute right-3 top-[calc(env(safe-area-inset-top)_+_0.75rem)] z-20" : "relative"}
    >
      <button
        type="button"
        aria-label="더보기"
        onClick={() => setOpen((o) => !o)}
        className={
          floating
            ? "flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur active:scale-95"
            : "flex h-9 w-9 items-center justify-center rounded-full text-ink active:scale-95"
        }
      >
        <MoreVertical size={20} />
      </button>
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="absolute right-0 top-12 z-30 w-44 overflow-hidden rounded-2xl border border-stone-200 bg-white py-1 shadow-lg"
        >
          {children}
        </div>
      )}
    </div>
  );
}
