"use client";

import { useState } from "react";

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-forest" : "bg-stone-300"}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${on ? "left-[22px]" : "left-0.5"}`}
      />
    </button>
  );
}

export default function NotificationSettings({
  initial,
}: {
  initial: { notifyLike: boolean; notifyComment: boolean };
}) {
  const [likes, setLikes] = useState(initial.notifyLike);
  const [comments, setComments] = useState(initial.notifyComment);
  const [saved, setSaved] = useState(false);

  async function save(next: { notifyLike: boolean; notifyComment: boolean }) {
    await fetch("/api/me/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    }).catch(() => {});
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="mt-4">
      <div className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200/80">
        <div className="flex items-center gap-3 bg-white px-4 py-3.5">
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold text-ink">좋아요 알림</div>
            <div className="text-[12px] text-stone-400">내 글이 좋아요를 받으면</div>
          </div>
          <Toggle
            on={likes}
            onClick={() => {
              const v = !likes;
              setLikes(v);
              void save({ notifyLike: v, notifyComment: comments });
            }}
          />
        </div>
        <div className="flex items-center gap-3 bg-white px-4 py-3.5">
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold text-ink">댓글·답글 알림</div>
            <div className="text-[12px] text-stone-400">내 글·댓글에 댓글/답글이 달리면</div>
          </div>
          <Toggle
            on={comments}
            onClick={() => {
              const v = !comments;
              setComments(v);
              void save({ notifyLike: likes, notifyComment: v });
            }}
          />
        </div>
      </div>
      <p className="mt-2 h-4 text-[12px] text-forest">{saved ? "저장됐어요." : ""}</p>
      <p className="mt-1 text-[12px] text-stone-400">
        ※ 지금은 앱 안 알림(종 아이콘) 기준이에요. 폰 푸시 알림은 추후 지원돼요.
      </p>
    </div>
  );
}
