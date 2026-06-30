"use client";

import { useActionState } from "react";
import { confirmLegalNameAction, type LegalNameState } from "@/app/actions/onboarding";

export default function RealNameForm() {
  const [state, action, pending] = useActionState<LegalNameState, FormData>(confirmLegalNameAction, undefined);

  return (
    <form action={action} className="mt-8 space-y-4">
      <div>
        <label className="label">실명</label>
        <input
          name="legalName"
          required
          minLength={2}
          maxLength={20}
          autoComplete="name"
          className="input"
          placeholder="예: 홍길동"
        />
      </div>
      <p className="text-[13px] font-semibold text-coral-dark">
        ⚠️ 한 번 입력하면 수정할 수 없어요. 신중히 입력해주세요.
      </p>
      {state?.error && <p className="text-sm text-red-500">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "저장 중..." : "확인하고 시작하기"}
      </button>
    </form>
  );
}
