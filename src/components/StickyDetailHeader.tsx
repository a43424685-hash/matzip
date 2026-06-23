"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/**
 * 상세 화면 상단 sticky 헤더.
 * 사진을 지나 스크롤했을 때만 얇게 등장 (사진 감성은 안 가림).
 */
export default function StickyDetailHeader({ name }: { name: string }) {
  const router = useRouter();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 240);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`fixed inset-x-0 top-0 z-30 mx-auto max-w-md border-b border-stone-200/70 bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur transition-all duration-200 ${
        show ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-full opacity-0"
      }`}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          onClick={() => router.back()}
          aria-label="뒤로"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink active:scale-95"
        >
          <ArrowLeft size={20} strokeWidth={2.2} />
        </button>
        <span className="truncate text-[15px] font-extrabold text-ink">{name}</span>
      </div>
    </div>
  );
}
