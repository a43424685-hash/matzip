"use client";

import { useActionState } from "react";
import { saveBankAccountAction, type BankState } from "@/app/actions/account";

export default function BankAccountForm({
  legalName,
  initial,
}: {
  legalName: string;
  initial?: { bankName: string | null; accountNumber: string | null; accountHolder: string | null } | null;
}) {
  const [state, action, pending] = useActionState<BankState, FormData>(saveBankAccountAction, undefined);

  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="label">은행</label>
        <input name="bankName" defaultValue={initial?.bankName ?? ""} required className="input" placeholder="예: 카카오뱅크" />
      </div>
      <div>
        <label className="label">계좌번호</label>
        <input
          name="accountNumber"
          defaultValue={initial?.accountNumber ?? ""}
          required
          inputMode="numeric"
          className="input"
          placeholder="‘-’ 포함 가능"
        />
      </div>
      <div>
        <label className="label">예금주명</label>
        <input name="accountHolder" defaultValue={initial?.accountHolder ?? ""} required className="input" placeholder={legalName} />
        <p className="mt-1 text-[12px] text-stone-400">
          본인 실명(<b className="text-ink">{legalName}</b>)과 일치해야 해요.
        </p>
      </div>
      {state?.error && <p className="text-sm text-coral-dark">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "저장 중…" : initial?.bankName ? "계좌 수정" : "계좌 등록"}
      </button>
    </form>
  );
}
