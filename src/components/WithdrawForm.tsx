"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Loader2 } from "lucide-react";

export default function WithdrawForm({
  availableWon,
  minWon,
  canWithdraw,
  hasPending,
}: {
  availableWon: number;
  minWon: number;
  canWithdraw: boolean;
  hasPending: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  if (hasPending) {
    return (
      <div className="mt-3 rounded-xl bg-stone-50 p-3.5 text-center text-[13px] font-semibold text-ink-muted">
        출금 신청이 접수됐어요. 운영자 확인 후 입금돼요.
      </div>
    );
  }

  if (!canWithdraw) {
    return (
      <div className="mt-3 rounded-xl bg-stone-50 p-3.5 text-center text-[13px] text-ink-muted">
        <b className="text-ink">{minWon.toLocaleString()}원</b>부터 출금 신청할 수 있어요.
      </div>
    );
  }

  async function submit() {
    if (busy) return;
    setBusy(true);
    setErr("");
    const r = await fetch("/api/withdrawals/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bankName, accountNumber, accountHolder }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok && d.ok) {
      router.refresh();
    } else {
      setErr(d.message || "신청에 실패했어요.");
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary mt-3 h-12 w-full !text-base">
        <Banknote size={18} /> {availableWon.toLocaleString()}원 출금 신청
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-2xl border border-forest/20 bg-forest-soft/20 p-4">
      <p className="mb-2 text-[13px] font-bold text-ink">정산받을 계좌</p>
      <div className="space-y-2">
        <input className="input h-11" placeholder="은행 (예: 카카오뱅크)" value={bankName} onChange={(e) => setBankName(e.target.value)} />
        <input className="input h-11" placeholder="계좌번호 ('-' 없이)" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
        <input className="input h-11" placeholder="예금주" value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} />
      </div>
      <button onClick={submit} disabled={busy} className="btn-primary mt-3 h-12 w-full !text-base disabled:opacity-50">
        {busy ? <><Loader2 size={17} className="animate-spin" /> 신청 중…</> : <>{availableWon.toLocaleString()}원 출금 신청하기</>}
      </button>
      {err && <p className="mt-2 text-center text-[13px] text-coral-dark">{err}</p>}
      <p className="mt-2 text-[11px] text-stone-400">신청 후 운영자가 입금 처리하면 잔액에서 차감돼요.</p>
    </div>
  );
}
