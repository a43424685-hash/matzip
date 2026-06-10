"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Loader2 } from "lucide-react";

export default function AdminRefundButton({ purchaseId, amountWon }: { purchaseId: string; amountWon: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function refund() {
    if (busy) return;
    if (!confirm(`${amountWon.toLocaleString()}원을 환불할까요?\n구매자 카드/카카오페이로 돈이 돌아가고, 지도 접근이 회수돼요.`)) return;
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
      alert(d.message || "환불에 실패했어요.");
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
