"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function FollowButton({
  targetId,
  initialFollowing,
  full = false,
  nickname,
}: {
  targetId: string;
  initialFollowing: boolean;
  full?: boolean;
  nickname?: string;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(false);

  async function follow() {
    if (busy) return;
    setBusy(true);
    setFollowing(true); // 낙관적
    const r = await fetch("/api/follows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetId }),
    });
    setBusy(false);
    if (r.ok) router.refresh();
    else {
      setFollowing(false);
      alert("팔로우에 실패했어요.");
    }
  }

  async function unfollow() {
    setSheet(false);
    setBusy(true);
    setFollowing(false);
    const r = await fetch("/api/follows", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetId }),
    });
    setBusy(false);
    if (r.ok) router.refresh();
    else {
      setFollowing(true);
      alert("언팔로우에 실패했어요.");
    }
  }

  async function block() {
    setSheet(false);
    if (!confirm(`${nickname ?? "이 사용자"}님을 차단할까요?\n팔로우가 해제되고 이 사람의 글·댓글이 안 보여요. (마이페이지에서 해제 가능)`)) return;
    setBusy(true);
    // 차단 + 팔로우 해제
    await fetch("/api/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockedId: targetId }),
    }).catch(() => {});
    await fetch("/api/follows", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetId }),
    }).catch(() => {});
    setBusy(false);
    setFollowing(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => (following ? setSheet(true) : follow())}
        disabled={busy}
        className={`shrink-0 rounded-full text-sm font-bold disabled:opacity-60 ${
          full ? "h-11 w-full" : "h-9 px-4"
        } ${following ? "border border-stone-300 bg-white text-ink-muted" : "bg-forest text-white"}`}
      >
        {following ? "팔로잉" : "팔로우"}
      </button>

      {sheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setSheet(false)}>
          <div className="w-full max-w-md rounded-t-2xl bg-white p-4 pb-6" onClick={(e) => e.stopPropagation()}>
            <p className="px-1 py-2 text-center text-[13px] text-stone-400">
              {nickname ? `${nickname}님` : "이 사용자"}
            </p>
            <button
              type="button"
              onClick={unfollow}
              className="w-full rounded-xl px-4 py-3.5 text-center text-[15px] font-bold text-ink active:bg-stone-50"
            >
              언팔로우
            </button>
            <button
              type="button"
              onClick={block}
              className="w-full rounded-xl px-4 py-3.5 text-center text-[15px] font-bold text-coral-dark active:bg-stone-50"
            >
              차단하기
            </button>
            <button
              type="button"
              onClick={() => setSheet(false)}
              className="mt-1 w-full rounded-xl px-4 py-3.5 text-center text-[15px] text-stone-400 active:bg-stone-50"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </>
  );
}
