"use client";

import { useEffect, useState } from "react";

export default function AppSplash() {
  // 처음부터 인트로가 화면을 덮게 해서 홈이 0.1초 보였다 사라지는 깜빡임 방지
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    // 이번 세션에 이미 본 경우엔 바로 숨김(반복 노출 방지)
    if (window.sessionStorage.getItem("mukgopin-splash-seen") === "1") {
      setVisible(false);
      return;
    }
    window.sessionStorage.setItem("mukgopin-splash-seen", "1");

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
