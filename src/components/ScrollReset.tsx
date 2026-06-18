"use client";

import { useEffect, useLayoutEffect } from "react";
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

  useLayoutEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    const getTop = () =>
      Math.max(
        window.scrollY || 0,
        window.pageYOffset || 0,
        document.scrollingElement?.scrollTop || 0,
        document.documentElement.scrollTop || 0,
        document.body.scrollTop || 0,
      );

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
    // 탭(touchstart)은 링크 이동 시작일 수 있으므로 사용자 스크롤로 보지 않는다.
    // 실제 스크롤 의도인 touchmove/wheel/key만 감시 중단.
    window.addEventListener("touchmove", markUser, { passive: true });
    window.addEventListener("wheel", markUser, { passive: true });
    window.addEventListener("keydown", markUser);

    // 브라우저가 늦게 복원해 스크롤이 튀면 되돌림 (사용자가 안 만졌을 때만)
    const onScroll = () => {
      if (!userInteracted && getTop() > 0) toTop();
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
    // iOS Chrome은 링크 탭 후 실제 레이아웃/복원이 늦게 들어오는 경우가 있어 넉넉히 잡는다.
    const stopRaf = window.setTimeout(() => cancelAnimationFrame(rafId), 900);

    // scroll 이벤트 없이 값만 복원되는 iOS 케이스까지 잡기 위한 짧은 폴링.
    const poll = window.setInterval(() => {
      if (!userInteracted && getTop() > 0) toTop();
    }, 50);

    // 감시견은 2초 후 해제 (그 사이 늦은 복원까지 커버, 사용자 조작은 위에서 이미 중단)
    const stopWatch = window.setTimeout(() => {
      window.removeEventListener("scroll", onScroll);
      window.clearInterval(poll);
    }, 2000);

    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(stopRaf);
      window.clearTimeout(stopWatch);
      window.clearInterval(poll);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("touchmove", markUser);
      window.removeEventListener("wheel", markUser);
      window.removeEventListener("keydown", markUser);
    };
  }, [pathname, search]);

  useEffect(() => {
    const toTop = () => {
      window.scrollTo(0, 0);
      const se = document.scrollingElement;
      if (se) se.scrollTop = 0;
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    const isInternalNavigation = (anchor: HTMLAnchorElement) => {
      if (anchor.target || anchor.hasAttribute("download")) return false;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return false;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return false;
      return url.pathname !== window.location.pathname || url.search !== window.location.search;
    };

    const onClickCapture = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest("a[href]");
      if (anchor instanceof HTMLAnchorElement && isInternalNavigation(anchor)) {
        toTop();
      }
    };

    // Next Link 기본 스크롤보다 먼저, 내부 링크 클릭 순간 이전 페이지 스크롤을 0으로 만든다.
    document.addEventListener("click", onClickCapture, true);

    // 사파리 뒤로/앞으로(bfcache) 복원 때도 맨 위로
    const onShow = () => toTop();
    window.addEventListener("pageshow", onShow);
    const onPopState = () => window.setTimeout(toTop, 0);
    window.addEventListener("popstate", onPopState);

    return () => {
      document.removeEventListener("click", onClickCapture, true);
      window.removeEventListener("pageshow", onShow);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  return null;
}
