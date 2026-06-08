"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export default function DeletePostButton({
  postId,
  label = "이 글 삭제",
  adminLabel,
}: {
  postId: string;
  label?: string;
  adminLabel?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function del() {
    if (!confirm("이 글을 삭제할까요? 되돌릴 수 없어요.")) return;
    setBusy(true);
    const r = await fetch(`/api/posts/${postId}`, { method: "DELETE" });
    if (r.ok) {
      router.replace("/");
      router.refresh();
    } else {
      setBusy(false);
      alert("삭제에 실패했어요.");
    }
  }

  return (
    <button
      type="button"
      onClick={del}
      disabled={busy}
      className="flex items-center justify-center gap-1.5 text-[13px] font-semibold text-coral-dark disabled:opacity-50"
    >
      <Trash2 size={14} /> {busy ? "삭제 중…" : adminLabel ?? label}
    </button>
  );
}
