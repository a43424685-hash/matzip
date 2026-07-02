"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Heart } from "lucide-react";

export default function CommunityLikeButton({
  postId,
  initialLiked,
  initialCount,
  isLoggedIn,
}: {
  postId: string;
  initialLiked: boolean;
  initialCount: number;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!isLoggedIn) {
      router.push(`/login?returnTo=${encodeURIComponent(pathname)}`);
      return;
    }
    if (busy) return;
    setBusy(true);
    const r = await fetch("/api/community/like", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok && d.ok) {
      setLiked(d.liked);
      setCount(d.likeCount);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-bold tabular-nums ${
        liked ? "border-coral/30 bg-coral-soft text-coral-dark" : "border-stone-200 bg-white text-ink-muted"
      }`}
    >
      <Heart size={16} fill={liked ? "currentColor" : "none"} /> {count}
    </button>
  );
}
