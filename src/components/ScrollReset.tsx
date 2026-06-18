"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * 페이지(경로/쿼리) 이동마다 스크롤을 항상 맨 위로.
 *
 * iOS(사파리/크롬 모두 WebKit)는 새 화면의 콘텐츠·이미지가 늦게 로드된 뒤
 * 이전 스크롤 위치를 비동기로 "복원"한다. 고정 타이머로는 그 늦은 복원을 못 막는다.
 * → "감시견" 방식: 이동 직후 일정 시간 동안, 사용자가 아직 손대지 않았는데
 *   스크롤이 0이 아닌 값으로 튀면(=브라우저의 복원) 즉시 0으로 되돌린다.
 *   사용자가 터치/휠/키로 스크롤을 시작하면 즉시 감시를 끈다(절대 사용자와 안 싸움).
 */
export default function ScrollReset() {
  const pathname = usePathname();
  const search = useSearchParams().toString();

  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    const toTop = () => {
      window.scrollTo(0, 0);
      const se = document.scrollingElement;
      if (se) se.scrollTop = 0;
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    let userInteracted = false;
    const markUser = () => {
      userInteracted = true;
    };
    // 사용자가 스크롤을 시작하면 감시 중단 (사용자 의도 존중)
    window.addEventListener("touchstart", markUser, { passive: true });
    window.addEventListener("touchmove", markUser, { passive: true });
    window.addEventListener("wheel", markUser, { passive: true });
    window.addEventListener("keydown", markUser);

    // 브라우저가 늦게 복원해 스크롤이 튀면 되돌림 (사용자가 안 만졌을 때만)
    const onScroll = () => {
      if (!userInteracted && window.scrollY > 0) toTop();
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    // 진입 직후 즉시 + 다음 프레임들에서도 맨 위로 (초기 레이아웃 대비)
    toTop();
    let rafId = 0;
    const raf = () => {
      if (userInteracted) return;
      toTop();
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);
    // rAF 강제는 0.4초까지만 (그 뒤는 onScroll 감시견이 복원만 잡음)
    const stopRaf = window.setTimeout(() => cancelAnimationFrame(rafId), 400);

    // 감시견은 1.6초 후 해제 (그 사이 늦은 복원까지 커버, 사용자 조작은 위에서 이미 중단)
    const stopWatch = window.setTimeout(() => {
      window.removeEventListener("scroll", onScroll);
    }, 1600);

    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(stopRaf);
      window.clearTimeout(stopWatch);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("touchstart", markUser);
      window.removeEventListener("touchmove", markUser);
      window.removeEventListener("wheel", markUser);
      window.removeEventListener("keydown", markUser);
    };
  }, [pathname, search]);

  useEffect(() => {
    // 사파리 뒤로/앞으로(bfcache) 복원 때도 맨 위로
    const onShow = () => window.scrollTo(0, 0);
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  return null;
}
