"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { appConfirm, toast } from "@/components/AppDialogs";

export default function CommunityDeleteButton({ postId, label = "삭제" }: { postId: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function del() {
    const ok = await appConfirm({ title: "이 글을 삭제할까요?", body: "되돌릴 수 없어요.", confirmLabel: "삭제", danger: true });
    if (!ok) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/community/${postId}`, { method: "DELETE" });
      if (r.ok) {
        router.replace("/community");
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
    <button type="button" onClick={del} disabled={busy} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13.5px] font-medium text-coral-dark hover:bg-stone-50">
      <Trash2 size={15} /> {busy ? "삭제 중…" : label}
    </button>
  );
}
