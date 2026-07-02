"use client";

import { useState } from "react";
import { Flag } from "lucide-react";

const REASONS = [
  { v: "spam", l: "스팸/광고" },
  { v: "abuse", l: "욕설/비방" },
  { v: "sexual", l: "음란물" },
  { v: "illegal", l: "불법정보" },
  { v: "wrong_info", l: "허위/잘못된 정보" },
  { v: "etc", l: "기타" },
];

export default function ReportButton({
  targetType,
  targetId,
  className = "flex items-center gap-1 text-stone-400",
}: {
  targetType: "post" | "comment" | "community_post" | "community_comment";
  targetId: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [msg, setMsg] = useState("");

  async function submit(reason: string) {
    setBusy(true);
    setMsg("");
    const r = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType, targetId, reason }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok && d.ok) {
      setDone(true);
      setOpen(false);
    } else {
      setMsg(
        d.reason === "DUPLICATE"
          ? "이미 신고했어요."
          : d.reason === "SELF"
            ? "내 콘텐츠는 신고할 수 없어요."
            : d.reason === "UNAUTHORIZED"
              ? "로그인이 필요해요."
              : "신고에 실패했어요."
      );
      if (d.reason === "DUPLICATE") setDone(true);
    }
  }

  if (done) return <span className={className}>신고됨</span>;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        <Flag size={12} /> 신고
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl bg-white p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-ink">신고 사유를 선택하세요</h3>
            <div className="mt-3 space-y-1.5">
              {REASONS.map((x) => (
                <button
                  key={x.v}
                  type="button"
                  disabled={busy}
                  onClick={() => submit(x.v)}
                  className="block w-full rounded-xl border border-stone-200 px-4 py-3 text-left text-sm font-medium text-ink active:scale-[0.99] disabled:opacity-50"
                >
                  {x.l}
                </button>
              ))}
            </div>
            {msg && <p className="mt-2 text-[13px] text-coral-dark">{msg}</p>}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-3 w-full py-2 text-sm text-stone-400"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </>
  );
}
