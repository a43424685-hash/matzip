"use client";

import { useActionState } from "react";
import {
  confirmNicknameAction,
  type NicknameState,
} from "@/app/actions/onboarding";

export default function NicknameForm({ nickname }: { nickname: string }) {
  const [state, action, pending] = useActionState<NicknameState, FormData>(
    confirmNicknameAction,
    undefined
  );

  return (
    <form action={action} className="mt-8 space-y-4">
      <div>
        <label className="label">닉네임</label>
        <input
          name="nickname"
          defaultValue={nickname}
          required
          minLength={2}
          maxLength={12}
          autoComplete="nickname"
          className="input"
          placeholder="예: 성수맛잘알"
        />
      </div>
      <p className="text-xs text-stone-500">2~12자, 한글·영문·숫자만 가능해요.</p>
      {state?.error && <p className="text-sm text-red-500">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "저장 중..." : "닉네임 정하고 시작하기"}
      </button>
    </form>
  );
}
