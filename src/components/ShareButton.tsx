"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Share2 } from "lucide-react";

/**
 * 공유 버튼 — 클릭 시 공유를 "기록"(인증글이면 작성자에게 공유 XP)하고
 * 공유 카드 페이지로 이동한다. (인증글에서만 렌더됨)
 */
export default function ShareButton({ postId, compact = false }: { postId: string; compact?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onShare() {
    if (busy) return;
    setBusy(true);
    try {
      // 공유 클릭 기록 (실패해도 공유 흐름은 계속)
      await fetch(`/api/posts/${postId}/share`, { method: "POST" }).catch(() => {});
    } finally {
      router.push(`/share/${postId}`);
    }
  }

  return (
    <button
      type="button"
      onClick={onShare}
      disabled={busy}
      className={compact ? "btn-outline h-10 w-full !text-sm" : "btn-outline h-12 w-full !text-base"}
    >
      <Share2 size={compact ? 15 : 18} /> {compact ? "공유" : "이 맛집 공유하기"}
    </button>
  );
}
