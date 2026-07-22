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
  // 서버 HTML에도 '항상' 그린다(solid). 이래야 브라우저가 홈을 먼저 그려서 번쩍이는 일이 없다.
  // 이미 본 세션(재방문/하드 네비)에선 <body> 최상단 인라인 스크립트가 '그리기 전에'
  // html.splash-seen 을 달아 CSS(.splash-seen .app-splash{display:none})로 숨겨 스플래시도 안 뜬다.
  // 콜드스타트(sessionStorage 비어있음)일 때만 서버가 그린 스플래시가 보이고, 잠시 뒤 페이드 아웃.
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let seen = false;
    try {
      seen = window.sessionStorage.getItem(SPLASH_SEEN_KEY) === "1";
    } catch {
      // sessionStorage 접근 불가 환경: 그냥 한 번 보여주고 넘어감
    }
    if (seen) {
      setVisible(false); // 재방문 — 즉시 제거(화면엔 이미 CSS로 숨겨져 있음)
      return;
    }
    markSplashSeen();
    const leave = window.setTimeout(() => setLeaving(true), 1100); // 페이드 아웃 시작
    const hide = window.setTimeout(() => setVisible(false), 1600); // 완전히 사라짐
    return () => {
      window.clearTimeout(leave);
      window.clearTimeout(hide);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`app-splash pointer-events-none fixed inset-0 z-[100] mx-auto w-full max-w-md overflow-hidden bg-stone-900 transition-opacity duration-[550ms] ease-in-out ${
        leaving ? "opacity-0" : "opacity-100"
      }`}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/splash-mukgopin.webp"
        alt=""
        className={`h-full w-full object-cover transition-transform duration-[1600ms] ease-out ${
          leaving ? "scale-[1.06]" : "scale-100"
        }`}
      />
    </div>
  );
}
