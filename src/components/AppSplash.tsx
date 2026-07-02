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
  // 처음부터 노출(홈 깜빡임 방지). pointer-events-none이라 터치는 안 막음.
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (window.sessionStorage.getItem(SPLASH_SEEN_KEY) === "1") {
      setVisible(false);
      return;
    }
    markSplashSeen();

    const leave = window.setTimeout(() => setLeaving(true), 1300);
    const hide = window.setTimeout(() => setVisible(false), 1600);
    return () => {
      window.clearTimeout(leave);
      window.clearTimeout(hide);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-[100] mx-auto w-full max-w-md overflow-hidden bg-stone-900 transition-opacity duration-300 ${
        leaving ? "opacity-0" : "opacity-100"
      }`}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/splash-mukgopin.webp"
        alt=""
        className="h-full w-full object-cover"
      />
    </div>
  );
}
