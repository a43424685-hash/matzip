"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveBankAccountAction, type BankState } from "@/app/actions/account";

export default function BankAccountForm({
  legalName,
  initial,
}: {
  legalName: string;
  // maskedNumber: 복호화 후 마스킹된 표시용 값(원문 아님). 수정 시 안내로만 노출.
  initial?: { bankName: string | null; maskedNumber: string | null; accountHolder: string | null } | null;
}) {
  const [state, action, pending] = useActionState<BankState, FormData>(saveBankAccountAction, undefined);
  const hasAccount = !!initial?.bankName && !!initial?.maskedNumber;

  return (
    <form action={action} className="space-y-3">
      {hasAccount && (
        <div className="rounded-xl bg-forest-soft/20 p-3 text-[13px] text-ink">
          현재 등록: <b>{initial!.bankName}</b> · {initial!.maskedNumber}
          <p className="mt-0.5 text-[12px] text-stone-400">보안을 위해 계좌번호는 일부만 표시돼요.</p>
        </div>
      )}
      <div>
        <label className="label">은행</label>
        <input name="bankName" defaultValue={initial?.bankName ?? ""} required className="input" placeholder="예: 카카오뱅크" />
      </div>
      <div>
        <label className="label">계좌번호</label>
        <input
          name="accountNumber"
          required={!hasAccount}
          inputMode="numeric"
          className="input"
          placeholder={hasAccount ? "변경할 때만 새 계좌번호 입력" : "‘-’ 포함 가능"}
        />
        {hasAccount && (
          <p className="mt-1 text-[12px] text-stone-400">비워두면 기존 계좌번호가 그대로 유지돼요.</p>
        )}
      </div>
      <div>
        <label className="label">예금주명</label>
        <input name="accountHolder" defaultValue={initial?.accountHolder ?? ""} required className="input" placeholder={legalName} />
        <p className="mt-1 text-[12px] text-stone-400">
          본인 실명(<b className="text-ink">{legalName}</b>)과 일치해야 해요.
        </p>
      </div>
      <label className="flex items-start gap-2 rounded-xl bg-stone-50 p-3 text-[12.5px] leading-relaxed text-ink-muted">
        <input type="checkbox" name="agree" required className="mt-0.5 h-4 w-4 shrink-0 accent-forest" />
        <span>
          판매 수수료 30% 차감·정산액 관련 세금 본인 부담, 잘못 입력한 계좌의 오입금 책임, 구매자 환불 시 정산액
          환수, 부정행위 적발 시 정산 보류·환수에 동의합니다.{" "}
          <Link href="/terms" className="font-semibold text-forest underline">
            자세히
          </Link>
        </span>
      </label>
      {state?.error && <p className="text-sm text-coral-dark">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "저장 중…" : hasAccount ? "계좌 수정" : "계좌 등록"}
      </button>
    </form>
  );
}
