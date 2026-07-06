"use client";

import { useEffect, useState } from "react";

// 스플래시는 "이번 앱 실행에서 봤음"을 sessionStorage로 기억한다.
// sessionStorage는 앱을 완전히 껐다 켜면(콜드스타트) 초기화 → 그때만 다시 노출.
// 로그인 후 홈으로 리다이렉트할 때 이 표시를 미리 찍어두면 로그인 직후엔 안 뜬다.
export const SPLASH_SEEN_KEY = "mukgopin-splash-seen";

export function markSplashSeen() {
  try {
    window.sessionStorage.setItem(SPLASH_SEEN_KEY, "1");
  } catch {
    // sessionStorage 접근 불가 환경은 무시
  }
}

export default function AppSplash() {
  // 서버/초기 렌더에선 아예 안 그린다(false). 이래야 페이지가 통째로 새로고침되는
  // 앱 내 이동(하드 네비게이션)마다 스플래시가 "깜빡" 뜨던 문제가 원천 차단된다.
  // 콜드스타트(앱 완전 재실행 → sessionStorage 비어있음)일 때만 노출한다.
  const [visible, setVisible] = useState(false);
  const [shown, setShown] = useState(false); // 페이드 인 완료 여부
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    // 이번 앱 실행에서 이미 봤으면(=콜드스타트 아님) 절대 안 뜬다.
    if (window.sessionStorage.getItem(SPLASH_SEEN_KEY) === "1") return;
    markSplashSeen();
    setVisible(true);

    // 다음 프레임에 opacity 0→1 로 부드럽게 페이드 인 (딱 켜지는 느낌 제거)
    const enter = window.requestAnimationFrame(() => setShown(true));
    const leave = window.setTimeout(() => setLeaving(true), 1600); // 페이드 아웃 시작
    const hide = window.setTimeout(() => setVisible(false), 2150); // 완전히 사라짐
    return () => {
      window.cancelAnimationFrame(enter);
      window.clearTimeout(leave);
      window.clearTimeout(hide);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-[100] mx-auto w-full max-w-md overflow-hidden bg-stone-900 transition-opacity duration-[550ms] ease-in-out ${
        leaving || !shown ? "opacity-0" : "opacity-100"
      }`}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/splash-mukgopin.webp"
        alt=""
        className={`h-full w-full object-cover transition-transform duration-[1600ms] ease-out ${
          shown && !leaving ? "scale-100" : "scale-[1.06]"
        }`}
      />
    </div>
  );
}
