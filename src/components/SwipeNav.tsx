"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * 화면 가장자리 스와이프로 뒤로/앞으로 가기 (iOS 엣지 스와이프 느낌).
 * - 왼쪽 끝에서 오른쪽으로 → 뒤로가기
 * - 오른쪽 끝에서 왼쪽으로 → 앞으로가기
 * 가운데 가로 스크롤(카드·칩)과 안 부딪히게 "가장자리 28px"에서 시작한 스와이프만 인식.
 */
export default function SwipeNav() {
  const router = useRouter();

  useEffect(() => {
    const EDGE = 28;
    let sx = 0,
      sy = 0,
      st = 0,
      fromLeft = false,
      fromRight = false;

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      sx = t.clientX;
      sy = t.clientY;
      st = Date.now();
      fromLeft = sx <= EDGE;
      fromRight = sx >= window.innerWidth - EDGE;
    };
    const onEnd = (e: TouchEvent) => {
      if (!fromLeft && !fromRight) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - sx;
      const dy = t.clientY - sy;
      const dt = Date.now() - st;
      // 빠르고(0.6s), 가로로 충분히(70px), 세로보단 가로 위주일 때만
      if (dt < 600 && Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.8) {
        if (fromLeft && dx > 0) router.back();
        else if (fromRight && dx < 0) router.forward();
      }
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [router]);

  return null;
}
