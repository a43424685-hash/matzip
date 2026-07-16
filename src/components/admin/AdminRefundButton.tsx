"use client";

import { useState } from "react";
import { appConfirm, toast } from "@/components/AppDialogs";
import { useRouter } from "next/navigation";
import { RotateCcw, Loader2 } from "lucide-react";

export default function AdminRefundButton({ purchaseId, amountWon }: { purchaseId: string; amountWon: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function refund() {
    if (busy) return;
    const ok = await appConfirm({
      title: `${amountWon.toLocaleString()}원 구매를 환불 처리할까요?`,
      body: "지도 접근이 회수되고 정산 대상에서 제외돼요.\n실제 결제 환불은 App Store·Google Play에서 처리돼요.",
      confirmLabel: "환불 처리",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    const r = await fetch("/api/admin/refunds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purchaseId }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok && d.ok) {
      router.refresh();
    } else {
      setBusy(false);
      toast(d.message || "환불에 실패했어요.", "error");
    }
  }

  return (
    <button
      onClick={refund}
      disabled={busy}
      className="flex items-center gap-1 rounded-lg border border-coral/40 px-2.5 py-1.5 text-[12px] font-bold text-coral-dark active:scale-95 disabled:opacity-50"
    >
      {busy ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />} 환불
    </button>
  );
}
