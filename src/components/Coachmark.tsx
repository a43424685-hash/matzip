"use client";

import { useEffect, useState } from "react";

/**
 * 한 번만 뜨는 안내 말풍선(코치마크). enabled일 때 진입 직후 잠깐 뒤 표시,
 * 닫으면 localStorage 에 기록해 다시 안 뜸. 위치는 parent가 position 으로 지정.
 */
export default function Coachmark({
  storageKey,
  enabled,
  text,
  position = "",
  arrow = "none",
}: {
  storageKey: string;
  enabled: boolean;
  text: string;
  position?: string;
  arrow?: "down" | "up" | "none";
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    try {
      if (localStorage.getItem(storageKey)) return;
    } catch {}
    const t = setTimeout(() => setShow(true), 500);
    return () => clearTimeout(t);
  }, [enabled, storageKey]);

  if (!show) return null;

  function dismiss() {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {}
    setShow(false);
  }

  return (
    <div className={`z-[60] ${position}`}>
      <button
        onClick={dismiss}
        className="relative block animate-pulse rounded-2xl bg-ink px-4 py-3 text-left text-[13px] font-bold leading-snug text-white shadow-xl"
      >
        {text}
        <span className="mt-1 block text-[11px] font-semibold text-white/70">탭하면 닫혀요</span>
        {arrow === "down" && (
          <span className="absolute -bottom-2 right-7 h-0 w-0 border-x-8 border-t-8 border-x-transparent border-t-ink" />
        )}
        {arrow === "up" && (
          <span className="absolute -top-2 left-7 h-0 w-0 border-x-8 border-b-8 border-x-transparent border-b-ink" />
        )}
      </button>
    </div>
  );
}
