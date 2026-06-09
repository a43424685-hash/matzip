"use client";

import { useEffect, useState } from "react";

export default function AppSplash() {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (window.sessionStorage.getItem("mukgopin-splash-seen") === "1") return;
    window.sessionStorage.setItem("mukgopin-splash-seen", "1");
    setVisible(true);

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
      className={`fixed inset-0 z-[100] mx-auto w-full max-w-md overflow-hidden bg-stone-900 transition-opacity duration-300 ${
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
