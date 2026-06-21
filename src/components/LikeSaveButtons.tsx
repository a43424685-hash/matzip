"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Heart, Bookmark } from "lucide-react";
import { markScrollReset } from "@/lib/scrollReset";

export default function LikeSaveButtons({
  postId,
  restaurantId,
  initialLiked,
  initialSaved,
  initialLikeCount,
  initialSaveCount,
  isLoggedIn,
}: {
  postId: string;
  restaurantId: string;
  initialLiked: boolean;
  initialSaved: boolean;
  initialLikeCount: number;
  initialSaveCount: number;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [liked, setLiked] = useState(initialLiked);
  const [saved, setSaved] = useState(initialSaved);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [saveCount, setSaveCount] = useState(initialSaveCount);
  const [pending, start] = useTransition();

  function requireLogin(): boolean {
    if (!isLoggedIn) {
      markScrollReset();
      router.push(`/login?returnTo=${encodeURIComponent(pathname)}`);
      return false;
    }
    return true;
  }

  async function onLike() {
    if (!requireLogin()) return;
    const res = await fetch("/api/like", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId }),
    });
    if (res.ok) {
      const d = await res.json();
      setLiked(d.liked);
      setLikeCount(d.likeCount);
    }
  }

  async function onSave() {
    if (!requireLogin()) return;
    const res = await fetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId, postId }),
    });
    if (res.ok) {
      const d = await res.json();
      setSaved(d.saved);
      setSaveCount(d.saveCount);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => start(onLike)}
        disabled={pending}
        aria-pressed={liked}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2.5 text-[13px] font-semibold tabular-nums transition ${
          liked
            ? "border-coral/30 bg-coral-soft text-coral-dark"
            : "border-stone-200 bg-white text-ink-muted hover:border-stone-300"
        }`}
      >
        <Heart size={15} fill={liked ? "currentColor" : "none"} />
        {likeCount}
      </button>
      <button
        onClick={() => start(onSave)}
        disabled={pending}
        aria-pressed={saved}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2.5 text-[13px] font-semibold tabular-nums transition ${
          saved
            ? "border-forest/30 bg-forest-soft text-forest"
            : "border-stone-200 bg-white text-ink-muted hover:border-stone-300"
        }`}
      >
        <Bookmark size={15} fill={saved ? "currentColor" : "none"} />
        {saveCount}
      </button>
    </div>
  );
}
