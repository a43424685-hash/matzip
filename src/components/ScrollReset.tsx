"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * 페이지(경로) 이동마다 스크롤을 항상 맨 위로.
 * 모바일 브라우저의 스크롤 복원/지연 때문에 화면이 중간에서 시작되는 걸 방지.
 */
export default function ScrollReset() {
  const pathname = usePathname();
  // 정렬/필터처럼 경로는 그대로고 쿼리만 바뀌는 경우도 감지 (랭킹 탭/검색·주변 필터 등)
  const search = useSearchParams().toString();

  useEffect(() => {
    // 브라우저 자동 스크롤 복원 끄기
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    // 모든 스크롤 레이어를 0으로 (iOS는 window.scrollTo가 안 먹을 때가 있음)
    const toTop = () => {
      window.scrollTo(0, 0);
      const se = document.scrollingElement;
      if (se) se.scrollTop = 0;
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };
    // 진입 직후 ~0.4초 동안 매 프레임 강제 (iOS의 늦은 스크롤 복원을 끝까지 이김)
    let raf = 0;
    const start = performance.now();
    const loop = () => {
      toTop();
      if (performance.now() - start < 700) {
        raf = requestAnimationFrame(loop);
      }
    };
    toTop();
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [pathname, search]);

  useEffect(() => {
    // 사파리 뒤로/앞으로(bfcache) 복원 때도 맨 위로
    const onShow = () => window.scrollTo(0, 0);
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  return null;
}
