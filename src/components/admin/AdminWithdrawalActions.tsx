"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Loader2 } from "lucide-react";

export default function AdminWithdrawalActions({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"paid" | "reject" | null>(null);

  async function run(action: "paid" | "reject") {
    if (busy) return;
    if (action === "reject" && !confirm("이 출금 신청을 반려할까요? (잔액으로 되돌아가요)")) return;
    if (action === "paid" && !confirm("실제로 계좌이체를 완료하셨나요? '지급완료'로 처리하면 잔액에서 차감돼요.")) return;
    setBusy(action);
    const r = await fetch("/api/admin/withdrawals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    if (r.ok) {
      router.refresh();
    } else {
      setBusy(null);
      alert("처리에 실패했어요.");
    }
  }

  return (
    <div className="flex gap-1.5">
      <button
        onClick={() => run("paid")}
        disabled={!!busy}
        className="flex items-center gap-1 rounded-lg bg-forest px-2.5 py-1.5 text-[12px] font-bold text-white active:scale-95 disabled:opacity-50"
      >
        {busy === "paid" ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} 입금완료
      </button>
      <button
        onClick={() => run("reject")}
        disabled={!!busy}
        className="flex items-center gap-1 rounded-lg border border-stone-300 px-2 py-1.5 text-[12px] font-bold text-stone-500 active:scale-95 disabled:opacity-50"
      >
        <X size={13} /> 반려
      </button>
    </div>
  );
}
