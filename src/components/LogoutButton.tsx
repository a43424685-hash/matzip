"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";

/**
 * 로그아웃 — 세션 제거 후 하드 이동(window.location)으로 홈 새로고침.
 * (소프트 네비게이션 대신 새로고침이라 홈이 항상 맨 위 + 세션 즉시 반영)
 */
export default function LogoutButton() {
  const [busy, setBusy] = useState(false);

  async function logout() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/";
    }
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={busy}
      className="flex w-full items-center gap-3 px-1 py-3.5 text-left text-[15px] text-ink-muted"
    >
      <span className="text-stone-400">
        <LogOut size={18} />
      </span>
      로그아웃
    </button>
  );
}
