"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function FollowButton({
  targetId,
  initialFollowing,
}: {
  targetId: string;
  initialFollowing: boolean;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    const next = !following;
    setBusy(true);
    setFollowing(next); // 낙관적 토글
    const r = await fetch("/api/follows", {
      method: next ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetId }),
    });
    setBusy(false);
    if (r.ok) {
      router.refresh();
    } else {
      setFollowing(!next); // 실패 시 되돌리기
      alert(next ? "팔로우에 실패했어요." : "언팔로우에 실패했어요.");
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className={`h-9 shrink-0 rounded-full px-4 text-sm font-bold disabled:opacity-60 ${
        following
          ? "border border-stone-300 bg-white text-ink-muted"
          : "bg-forest text-white"
      }`}
    >
      {following ? "팔로잉" : "팔로우"}
    </button>
  );
}
