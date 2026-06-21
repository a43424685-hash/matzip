"use client";

import { useEffect, useLayoutEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { SCROLL_RESET_FLAG, markScrollReset } from "@/lib/scrollReset";

// 새 화면 진입 시 모든 스크롤 레이어를 맨 위로
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

// 새 탭/수정키/다운로드/외부/해시/같은 화면 클릭은 제외한 "내부 페이지 이동" 판별
function isInternalNavClick(a: HTMLAnchorElement, e: MouseEvent): boolean {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  if (a.target && a.target !== "_self") return false;
  if (a.hasAttribute("download")) return false;
  const href = a.getAttribute("href");
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return false;
  let url: URL;
  try {
    url = new URL(a.href, window.location.href);
  } catch {
    return false;
  }
  if (url.origin !== window.location.origin) return false;
  // 같은 경로+쿼리(해시만 이동 등)는 제외
  if (url.pathname === window.location.pathname && url.search === window.location.search) return false;
  return true;
}

function takeFlag(): boolean {
  try {
    if (sessionStorage.getItem(SCROLL_RESET_FLAG)) {
      sessionStorage.removeItem(SCROLL_RESET_FLAG);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

export default function ScrollReset() {
  const pathname = usePathname();
  const search = useSearchParams().toString();

  // 내부 이동 감지 → 플래그. (첫 로드/뒤로가기에는 세팅되지 않음)
  useEffect(() => {
    const onClickCapture = (e: MouseEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      const anchor = target?.closest("a[href]");
      if (anchor instanceof HTMLAnchorElement && isInternalNavClick(anchor, e)) markScrollReset();
    };
    // 내부 <a> 링크 클릭만 감지. programmatic 이동(router.push/replace)은 호출부에서
    // markScrollReset()로 직접 플래그를 켠다. (pushState 전역 패치는 뒤로가기 내부 처리에도
    // 걸려 브라우저 복원을 망가뜨리므로 쓰지 않는다.)
    document.addEventListener("click", onClickCapture, true);
    return () => {
      document.removeEventListener("click", onClickCapture, true);
    };
  }, []);

  // route(경로/쿼리) 변경 후, "내부 이동 플래그"가 있을 때만 단계적으로 top.
  useLayoutEffect(() => {
    if (!takeFlag()) return; // 첫 로드·뒤로가기 등은 아무것도 하지 않음(복원 허용)

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
    // iOS 늦은 복원 대응 — 즉시/rAF/단계적 (사용자가 스크롤 시작하면 중단)
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
