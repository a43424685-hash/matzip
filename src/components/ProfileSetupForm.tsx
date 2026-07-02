"use client";

import { useActionState } from "react";
import { confirmProfileAction, type ProfileSetupState } from "@/app/actions/onboarding";

export default function ProfileSetupForm({ nickname }: { nickname: string }) {
  const [state, action, pending] = useActionState<ProfileSetupState, FormData>(
    confirmProfileAction,
    undefined
  );

  return (
    <form action={action} className="mt-8 space-y-6">
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
        <p className="mt-1.5 text-xs text-stone-500">
          랭킹·맛집 카드에 보일 이름. 2~12자, 한글·영문·숫자만.
        </p>
      </div>

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
        <p className="mt-1.5 text-xs leading-relaxed text-stone-500">
          본인 확인용. <b className="text-ink">비공개</b>로 안전하게 보관되고 화면엔 닉네임만 보여요.
          <br />
          <span className="font-semibold text-coral-dark">한 번 입력하면 수정할 수 없어요.</span>
        </p>
      </div>

      {state?.error && <p className="text-sm text-red-500">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "저장 중..." : "확인하고 시작하기"}
      </button>
    </form>
  );
}
