"use client";

import { useLayoutEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// 모든 스크롤 레이어를 맨 위로 (iOS는 window.scrollTo가 안 먹을 때가 있어 직접도 0)
function scrollAllToTop() {
  window.scrollTo(0, 0);
  const se = document.scrollingElement;
  if (se) se.scrollTop = 0;
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  document
    .querySelectorAll<HTMLElement>("[data-scroll-root], .overflow-y-auto, .overflow-auto, .overflow-y-scroll")
    .forEach((el) => {
      el.scrollTop = 0;
    });
}

/**
 * 스크롤 최상단 — "무조건 맨 위" 정책.
 *  경로/쿼리가 바뀌는 모든 이동(탭·링크·push·replace·서버 리다이렉트·뒤로/앞으로)에서 맨 위로.
 *  iOS의 늦은 스크롤 복원까지 이기도록 진입 직후 몇 번 더 0으로 보내고,
 *  사용자가 스크롤을 시작하면 즉시 중단(억지로 위로 안 끌어올림).
 */
export default function ScrollReset() {
  const pathname = usePathname();
  const search = useSearchParams().toString();

  useLayoutEffect(() => {
    if ("scrollRestoration" in window.history) {
      // 브라우저 자동 복원 끄기 — 우리가 항상 맨 위로 제어
      window.history.scrollRestoration = "manual";
    }
    scrollAllToTop();

    let userScrolled = false;
    const stop = () => {
      userScrolled = true;
    };
    window.addEventListener("touchstart", stop, { passive: true });
    window.addEventListener("touchmove", stop, { passive: true });
    window.addEventListener("wheel", stop, { passive: true });
    window.addEventListener("keydown", stop);

    const run = () => {
      if (!userScrolled) scrollAllToTop();
    };
    const raf = requestAnimationFrame(run);
    const timers = [50, 150, 350, 700, 1200].map((ms) => window.setTimeout(run, ms));

    const cleanup = () => {
      cancelAnimationFrame(raf);
      timers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("touchmove", stop);
      window.removeEventListener("wheel", stop);
      window.removeEventListener("keydown", stop);
    };
    const final = window.setTimeout(cleanup, 1300);
    return () => {
      window.clearTimeout(final);
      cleanup();
    };
  }, [pathname, search]);

  return null;
}
