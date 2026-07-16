"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";
import { appConfirm, toast } from "@/components/AppDialogs";

export default function BlockButton({
  userId,
  nickname,
  className = "flex items-center gap-1 text-stone-400",
}: {
  userId: string;
  nickname: string;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function block() {
    const ok = await appConfirm({
      title: `${nickname}님을 차단할까요?`,
      body: "이 사람의 글과 댓글이 안 보이게 돼요.\n(마이페이지 > 차단한 사용자에서 해제 가능)",
      confirmLabel: "차단",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const r = await fetch("/api/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blockedId: userId }),
      });
      if (r.ok) {
        toast(`${nickname}님을 차단했어요`, "success");
        // 차단하면 현재 보던 글이 가려지므로 홈으로 이동 (빈 화면 방지)
        router.push("/");
      } else {
        toast("차단에 실패했어요. 잠시 후 다시 시도해 주세요.", "error");
      }
    } catch {
      toast("네트워크 오류로 차단하지 못했어요.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={block} disabled={busy} className={className}>
      <Ban size={12} /> 차단
    </button>
  );
}
