"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { markScrollReset } from "@/lib/scrollReset";
import { appConfirm, toast } from "@/components/AppDialogs";

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
    const ok = await appConfirm({ title: "이 글을 삭제할까요?", body: "되돌릴 수 없어요.", confirmLabel: "삭제", danger: true });
    if (!ok) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/posts/${postId}`, { method: "DELETE" });
      if (r.ok) {
        markScrollReset();
        router.replace("/");
        router.refresh();
        return;
      }
      toast("삭제에 실패했어요.", "error");
    } catch {
      toast("네트워크 오류로 삭제하지 못했어요.", "error");
    }
    setBusy(false);
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
