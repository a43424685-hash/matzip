"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Banknote, Loader2 } from "lucide-react";

export default function WithdrawForm({
  availableWon,
  minWon,
  canWithdraw,
  hasPending,
  account,
}: {
  availableWon: number;
  minWon: number;
  canWithdraw: boolean;
  hasPending: boolean;
  account: { bankName: string; accountNumber: string; accountHolder: string } | null;
}) {
  const router = useRouter();
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

  if (!account) {
    return (
      <Link
        href="/me/account"
        className="btn-primary mt-3 flex h-12 w-full items-center justify-center !text-base"
      >
        정산 계좌 먼저 등록하기
      </Link>
    );
  }

  async function submit() {
    if (busy || !account) return;
    setBusy(true);
    setErr("");
    const r = await fetch("/api/withdrawals/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(account),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok && d.ok) {
      router.refresh();
    } else {
      setErr(d.message || "신청에 실패했어요.");
    }
  }

  return (
    <div className="mt-3 rounded-2xl border border-forest/20 bg-forest-soft/20 p-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-bold text-ink">정산받을 계좌</p>
        <Link href="/me/account" className="text-[12px] font-semibold text-forest">
          변경
        </Link>
      </div>
      <p className="mt-1 text-[13px] text-ink-muted">
        {account.bankName} · {account.accountNumber} · {account.accountHolder}
      </p>
      <button onClick={submit} disabled={busy} className="btn-primary mt-3 h-12 w-full !text-base disabled:opacity-50">
        {busy ? (
          <>
            <Loader2 size={17} className="animate-spin" /> 신청 중…
          </>
        ) : (
          <>
            <Banknote size={18} /> {availableWon.toLocaleString()}원 출금 신청
          </>
        )}
      </button>
      {err && <p className="mt-2 text-center text-[13px] text-coral-dark">{err}</p>}
      <p className="mt-2 text-[11px] text-stone-400">신청 후 운영자가 입금 처리하면 잔액에서 차감돼요.</p>
    </div>
  );
}
