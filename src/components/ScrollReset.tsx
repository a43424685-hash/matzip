"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const RESET_KEY = "muckpin-scroll-reset-until";
const RESET_MS = 2500;

function getScrollTop() {
  return Math.max(
    window.scrollY || 0,
    window.pageYOffset || 0,
    document.scrollingElement?.scrollTop || 0,
    document.documentElement.scrollTop || 0,
    document.body.scrollTop || 0,
  );
}

function scrollEverywhereToTop() {
  window.scrollTo(0, 0);
  const scrollingElement = document.scrollingElement;
  if (scrollingElement) scrollingElement.scrollTop = 0;
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;

  document
    .querySelectorAll<HTMLElement>("[data-scroll-root], .overflow-y-auto, .overflow-auto, .overflow-y-scroll")
    .forEach((el) => {
      el.scrollTop = 0;
      el.scrollLeft = 0;
    });
}

function markNavigationScrollReset() {
  const until = Date.now() + RESET_MS;
  try {
    sessionStorage.setItem(RESET_KEY, String(until));
  } catch {
    // sessionStorage can be unavailable in private/locked contexts.
  }
}

function hasPendingNavigationReset() {
  try {
    const until = Number(sessionStorage.getItem(RESET_KEY) || 0);
    return Number.isFinite(until) && until > Date.now();
  } catch {
    return false;
  }
}

function clearNavigationScrollReset() {
  try {
    sessionStorage.removeItem(RESET_KEY);
  } catch {
    // Ignore storage failures.
  }
}

function isInternalNavigation(anchor: HTMLAnchorElement) {
  if (anchor.target || anchor.hasAttribute("download")) return false;
  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return false;

  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  return url.pathname !== window.location.pathname || url.search !== window.location.search;
}

export default function ScrollReset() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const didMount = useRef(false);

  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    const onClickCapture = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest("a[href]");
      if (anchor instanceof HTMLAnchorElement && isInternalNavigation(anchor)) {
        markNavigationScrollReset();
      }
    };

    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function pushState(...args) {
      markNavigationScrollReset();
      return originalPushState.apply(this, args);
    };

    window.history.replaceState = function replaceState(...args) {
      markNavigationScrollReset();
      return originalReplaceState.apply(this, args);
    };

    const onPageShow = () => {
      if (hasPendingNavigationReset()) scrollEverywhereToTop();
    };

    const onPopState = () => {
      markNavigationScrollReset();
      window.setTimeout(scrollEverywhereToTop, 0);
    };

    document.addEventListener("click", onClickCapture, true);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("popstate", onPopState);

    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      document.removeEventListener("click", onClickCapture, true);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  useLayoutEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    const shouldRunBurst = didMount.current || hasPendingNavigationReset();
    didMount.current = true;

    scrollEverywhereToTop();
    if (!shouldRunBurst) return;

    let userScrolled = false;
    const stopForUserScroll = () => {
      userScrolled = true;
      clearNavigationScrollReset();
    };

    window.addEventListener("touchmove", stopForUserScroll, { passive: true });
    window.addEventListener("wheel", stopForUserScroll, { passive: true });
    window.addEventListener("keydown", stopForUserScroll);

    const startedAt = Date.now();
    let rafId = 0;
    const intervalId = window.setInterval(() => {
      if (!userScrolled && Date.now() - startedAt < RESET_MS && getScrollTop() > 0) {
        scrollEverywhereToTop();
      }
    }, 50);

    const frame = () => {
      if (userScrolled || Date.now() - startedAt >= RESET_MS) return;
      scrollEverywhereToTop();
      rafId = requestAnimationFrame(frame);
    };
    rafId = requestAnimationFrame(frame);

    const done = window.setTimeout(() => {
      clearNavigationScrollReset();
      window.clearInterval(intervalId);
      cancelAnimationFrame(rafId);
      window.removeEventListener("touchmove", stopForUserScroll);
      window.removeEventListener("wheel", stopForUserScroll);
      window.removeEventListener("keydown", stopForUserScroll);
    }, RESET_MS);

    return () => {
      window.clearTimeout(done);
      window.clearInterval(intervalId);
      cancelAnimationFrame(rafId);
      window.removeEventListener("touchmove", stopForUserScroll);
      window.removeEventListener("wheel", stopForUserScroll);
      window.removeEventListener("keydown", stopForUserScroll);
    };
  }, [pathname, search]);

  return null;
}
