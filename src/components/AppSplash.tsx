"use client";

import { useEffect, useState } from "react";

export default function AppSplash() {
  // 처음부터 노출(홈 깜빡임 방지). pointer-events-none이라 터치는 안 막음.
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
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
