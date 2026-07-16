"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EyeOff, Eye } from "lucide-react";
import { toast } from "@/components/AppDialogs";

export default function CommunityBlindButton({ postId, blinded }: { postId: string; blinded: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    const r = await fetch(`/api/community/${postId}/blind`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blinded: !blinded }),
    });
    if (r.ok) router.refresh();
    else {
      setBusy(false);
      toast("처리에 실패했어요.", "error");
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13.5px] font-medium text-ink hover:bg-stone-50"
    >
      {blinded ? <Eye size={15} /> : <EyeOff size={15} />} {blinded ? "블라인드 해제" : "블라인드 처리"}
    </button>
  );
}
