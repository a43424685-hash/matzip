"use client";

import { useEffect, useState } from "react";
import { PartyPopper } from "lucide-react";

/**
 * 구매 직후 1회 '언락 축하' 토스트 — "산 보람" 각인.
 * 컬렉션별 localStorage 키로 한 번만 노출.
 */
export default function UnlockCelebration({ collectionId, title, count }: { collectionId: string; title: string; count: number }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const key = `mgp:unlocked:${collectionId}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      return;
    }
    setShow(true);
    const t = setTimeout(() => setShow(false), 3200);
    return () => clearTimeout(t);
  }, [collectionId]);

  if (!show) return null;
  return (
    <div className="fixed inset-x-0 top-4 z-[80] flex justify-center px-5">
      <div className="animate-fade-in flex items-center gap-2 rounded-full bg-forest px-4 py-2.5 text-sm font-bold text-white shadow-lg">
        <PartyPopper size={18} /> 《{title}》 {count}곳 전부 열렸어요!
      </div>
    </div>
  );
}
