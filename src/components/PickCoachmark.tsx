"use client";

import { useEffect, useState } from "react";
import { Star, X } from "lucide-react";

/**
 * 운영자 PICK 맛집 상세에서 뜨는 코치마크 토스트.
 * "내 맛집으로 등록" 유도. 세션당 가게별 1회, 7초 후 자동 사라짐.
 */
export default function PickCoachmark({ postId }: { postId: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const key = `pickCoach:${postId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* sessionStorage 불가 시 그냥 표시 */
    }
    setShow(true);
    const t = setTimeout(() => setShow(false), 7000);
    return () => clearTimeout(t);
  }, [postId]);

  if (!show) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[88px] z-50 flex justify-center px-4">
      <div className="pointer-events-auto flex w-full max-w-md items-start gap-2.5 rounded-2xl bg-amber-500 px-4 py-3 text-white shadow-lg">
        <Star size={18} className="mt-0.5 shrink-0" strokeWidth={2.5} />
        <p className="flex-1 text-[13px] font-semibold leading-snug">
          운영자가 <b className="font-extrabold">추천</b>한 곳이에요. 마음에 들면 아래 <b className="font-extrabold">‘내 맛집으로 등록’</b> 버튼을 눌러보세요!
        </p>
        <button onClick={() => setShow(false)} aria-label="닫기" className="shrink-0 text-white/80">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
