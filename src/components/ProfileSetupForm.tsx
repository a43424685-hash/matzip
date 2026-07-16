"use client";

import { useActionState } from "react";
import { confirmNicknameAction, type NicknameState } from "@/app/actions/onboarding";

// 가입 온보딩 — 닉네임만 확정. 실명은 정산 계좌 등록(/me/account) 때 받는다.
export default function ProfileSetupForm({ nickname }: { nickname: string }) {
  const [state, action, pending] = useActionState<NicknameState, FormData>(
    confirmNicknameAction,
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
          랭킹·맛집 카드에 보일 이름. 2~12자, 한글·영문·숫자만. 나중에 프로필에서 바꿀 수 있어요.
        </p>
      </div>

      {state?.error && <p className="text-sm text-red-500">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "저장 중..." : "확인하고 시작하기"}
      </button>
      <p className="text-center text-[12px] leading-relaxed text-stone-400">
        시작하면{" "}
        <a href="/terms" className="underline">이용약관</a> 및{" "}
        <a href="/privacy" className="underline">개인정보처리방침</a>, 불쾌·혐오 콘텐츠와 악성 사용자에 대한{" "}
        <b className="font-semibold text-stone-500">무관용 정책</b>에 동의하는 것으로 간주돼요.
      </p>
    </form>
  );
}
