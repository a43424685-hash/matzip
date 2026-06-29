"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signupAction, type AuthState } from "@/app/actions/auth";

export default function SignupForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    signupAction,
    undefined
  );

  return (
    <main className="px-6 py-10">
      <div className="mb-8 text-center">
        <p className="text-[32px] leading-none">
          <span className="brand-logo">먹고</span>
          <span className="brand-logo-point">핀</span>
        </p>
        <p className="mt-2.5 text-sm text-ink-muted">내 맛집 지도를 키워볼까요?</p>
      </div>

      <form action={action} className="space-y-4">
        <div>
          <label className="label">이메일</label>
          <input
            name="email"
            type="email"
            required
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            inputMode="email"
            className="input"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label className="label">닉네임 <span className="font-normal text-stone-400">2~12자</span></label>
          <input name="nickname" required minLength={2} maxLength={12} className="input" placeholder="맛잘알" />
        </div>
        <div>
          <label className="label">비밀번호</label>
          <input name="password" type="password" required minLength={6} className="input" placeholder="6자 이상" />
        </div>
        <div>
          <label className="label">비밀번호 확인</label>
          <input name="confirmPassword" type="password" required minLength={6} className="input" placeholder="한 번 더 입력" />
        </div>
        <label className="flex items-start gap-2 text-[13px] text-ink-muted">
          <input type="checkbox" name="agree" required className="mt-0.5 h-4 w-4 shrink-0 accent-forest" />
          <span>
            <Link href="/terms" className="font-semibold text-forest underline">이용약관</Link> 및{" "}
            <Link href="/privacy" className="font-semibold text-forest underline">개인정보 처리방침</Link>에 동의합니다.
          </span>
        </label>
        {state?.error && <p className="text-sm text-red-500">{state.error}</p>}
        <button type="submit" disabled={pending} className="btn-primary w-full">
          {pending ? "가입 중…" : "이메일로 가입하기"}
        </button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs text-stone-400">
        <span className="h-px flex-1 bg-stone-200" />
        또는
        <span className="h-px flex-1 bg-stone-200" />
      </div>

      <a href="/api/auth/kakao" className="flex h-12 w-full items-center justify-center rounded-xl bg-[#FEE500] text-sm font-extrabold text-[#191600]">
        카카오로 시작하기
      </a>

      <p className="mt-6 text-center text-sm text-neutral-500">
        이미 계정이 있나요?{" "}
        <Link href="/login" className="font-semibold text-forest">
          로그인
        </Link>
      </p>
    </main>
  );
}
