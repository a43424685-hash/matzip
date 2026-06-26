"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";

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
    if (!confirm(`${nickname}님을 차단할까요?\n이 사람의 글과 댓글이 안 보이게 돼요. (마이페이지에서 해제 가능)`)) {
      return;
    }
    setBusy(true);
    const r = await fetch("/api/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockedId: userId }),
    });
    setBusy(false);
    if (r.ok) {
      alert(`${nickname}님을 차단했어요.\n이 사용자의 글과 댓글이 더 이상 보이지 않아요.\n(마이페이지 > 차단한 사용자 에서 해제 가능)`);
      // 차단하면 현재 보던 글이 가려지므로 홈으로 이동 (빈 화면 방지)
      router.push("/");
    } else {
      alert("차단에 실패했어요.");
    }
  }

  return (
    <button type="button" onClick={block} disabled={busy} className={className}>
      <Ban size={12} /> 차단
    </button>
  );
}
