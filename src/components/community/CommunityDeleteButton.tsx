"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export default function CommunityDeleteButton({ postId, label = "삭제" }: { postId: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function del() {
    if (!confirm("이 글을 삭제할까요? 되돌릴 수 없어요.")) return;
    setBusy(true);
    const r = await fetch(`/api/community/${postId}`, { method: "DELETE" });
    if (r.ok) {
      router.replace("/community");
      router.refresh();
    } else {
      setBusy(false);
      alert("삭제에 실패했어요.");
    }
  }

  return (
    <button type="button" onClick={del} disabled={busy} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13.5px] font-medium text-coral-dark hover:bg-stone-50">
      <Trash2 size={15} /> {busy ? "삭제 중…" : label}
    </button>
  );
}
