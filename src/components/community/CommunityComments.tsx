"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import OfficialBadge from "@/components/OfficialBadge";

type Comment = {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; nickname: string; avatarUrl: string | null; isAdmin: boolean };
};

export default function CommunityComments({
  postId,
  initial,
  isLoggedIn,
}: {
  postId: string;
  initial: Comment[];
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!isLoggedIn) {
      router.push(`/login?returnTo=${encodeURIComponent(pathname)}`);
      return;
    }
    const content = text.trim();
    if (!content || busy) return;
    setBusy(true);
    const r = await fetch(`/api/community/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    setBusy(false);
    if (r.ok) {
      setText("");
      router.refresh();
    }
  }

  return (
    <div>
      <div className="space-y-3">
        {initial.length === 0 ? (
          <p className="py-4 text-center text-[13px] text-stone-400">첫 댓글을 남겨보세요.</p>
        ) : (
          initial.map((c) => (
            <div key={c.id} className="flex gap-2.5">
              <Link href={`/u/${c.user.id}`} className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-forest-soft text-[13px] font-bold text-forest">
                {c.user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.user.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  c.user.nickname.slice(0, 1)
                )}
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`/u/${c.user.id}`} className="flex items-center gap-1 text-[13px] font-bold text-ink">
                  {c.user.nickname}
                  {c.user.isAdmin && <OfficialBadge size={12} />}
                </Link>
                <p className="whitespace-pre-wrap break-words text-[14px] text-ink">{c.content}</p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="댓글 달기…"
          className="min-w-0 flex-1 rounded-full bg-stone-100 px-4 py-2.5 text-[14px] outline-none"
        />
        <button onClick={submit} disabled={busy || !text.trim()} className="shrink-0 rounded-full bg-forest px-4 py-2.5 text-[13px] font-bold text-white disabled:opacity-40">
          등록
        </button>
      </div>
    </div>
  );
}
