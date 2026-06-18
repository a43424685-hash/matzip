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
    const toTop = () => window.scrollTo(0, 0);
    // 즉시 + 다음 두 프레임 + 약간 지연(사파리는 스크롤 복원이 늦게 일어남)
    toTop();
    const raf = requestAnimationFrame(() => {
      toTop();
      requestAnimationFrame(toTop);
    });
    const timer = window.setTimeout(toTop, 120);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [pathname]);

  useEffect(() => {
    // 사파리 뒤로/앞으로(bfcache) 복원 때도 맨 위로
    const onShow = () => window.scrollTo(0, 0);
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  return null;
}
