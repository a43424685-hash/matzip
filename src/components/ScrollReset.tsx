"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * 페이지(경로) 이동마다 스크롤을 항상 맨 위로.
 * 모바일 브라우저의 스크롤 복원/지연 때문에 화면이 중간에서 시작되는 걸 방지.
 */
export default function ScrollReset() {
  const pathname = usePathname();
  useEffect(() => {
    // 브라우저 자동 스크롤 복원 끄기
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    // 즉시 + 다음 프레임(레이아웃/이미지 반영 후)에 한 번 더 맨 위로
    window.scrollTo(0, 0);
    const id = requestAnimationFrame(() => window.scrollTo(0, 0));
    return () => cancelAnimationFrame(id);
  }, [pathname]);
  return null;
}
