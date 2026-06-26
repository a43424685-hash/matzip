"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { isNativeApp, openNativeLogin, nativeAppleLogin } from "@/lib/nativeAuth";

export default function LoginForm({ error, returnTo: rawReturn = "" }: { error?: string; returnTo?: string }) {
  // 오픈 리다이렉트 방지: 내부 절대경로(/foo)만 허용
  const returnTo = rawReturn.startsWith("/") && !rawReturn.startsWith("//") ? rawReturn : "/";
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setPending(true);

    const formData = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.get("email"),
          password: formData.get("password"),
        }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };
      if (!response.ok || !result.ok) {
        setMessage(result.error ?? "로그인에 실패했어요.");
        return;
      }
      // 하드 이동 — 항상 맨 위에서 시작 + 세션 즉시 반영
      window.location.href = returnTo;
      return;
    } catch {
      setMessage("잠시 후 다시 시도해주세요.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-[88vh] flex-col justify-center px-6 py-10">
      <div className="mb-9 text-center">
        <p className="text-[34px] leading-none">
          <span className="brand-logo">먹고</span>
          <span className="brand-logo-point">핀</span>
        </p>
        <p className="mt-3 text-sm text-ink-muted">맛집 발견하고 핀 꽂고, 레벨을 올려요 📍</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
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
            autoComplete="email"
            className="input"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label className="label">비밀번호</label>
          <input
            name="password"
            type="password"
            required
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="current-password"
            className="input"
            placeholder="••••••"
          />
        </div>
        {message && <p className="text-sm text-red-500">{message}</p>}
        {error === "kakao_not_configured" && (
          <p className="text-sm text-red-500">카카오 로그인이 아직 설정되지 않았어요.</p>
        )}
        {error === "kakao_failed" && (
          <p className="text-sm text-red-500">카카오 로그인에 실패했어요. 다시 시도해주세요.</p>
        )}
        {error === "apple_not_configured" && (
          <p className="text-sm text-red-500">Apple 로그인이 아직 설정되지 않았어요.</p>
        )}
        {error === "apple_failed" && (
          <p className="text-sm text-red-500">Apple 로그인에 실패했어요. 다시 시도해주세요.</p>
        )}
        <button type="submit" disabled={pending} className="btn-primary w-full">
          {pending ? "로그인 중…" : "로그인"}
        </button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs text-stone-400">
        <span className="h-px flex-1 bg-stone-200" />
        또는
        <span className="h-px flex-1 bg-stone-200" />
      </div>

      <a
        href={returnTo && returnTo !== "/" ? `/api/auth/apple?returnTo=${encodeURIComponent(returnTo)}` : "/api/auth/apple"}
        onClick={(e) => {
          if (isNativeApp()) {
            e.preventDefault();
            nativeAppleLogin().then((r) => {
              if (!r.ok && r.error && r.error !== "canceled") {
                setMessage("Apple 로그인에 실패했어요. 다시 시도해주세요.");
              }
            });
          }
        }}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-black text-sm font-extrabold text-white"
      >
        <svg width="14" height="17" viewBox="0 0 814 1000" fill="currentColor" aria-hidden="true">
          <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.2 40.8s-104.9-57-154.8-127C46.4 790.7 0 663 0 541.8c0-194.4 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z" />
        </svg>
        Apple로 로그인
      </a>

      <a
        href={returnTo && returnTo !== "/" ? `/api/auth/kakao?returnTo=${encodeURIComponent(returnTo)}` : "/api/auth/kakao"}
        onClick={(e) => {
          if (isNativeApp()) {
            e.preventDefault();
            openNativeLogin("kakao");
          }
        }}
        className="mt-3 flex h-12 w-full items-center justify-center rounded-xl bg-[#FEE500] text-sm font-extrabold text-[#191600]"
      >
        카카오로 시작하기
      </a>

      <p className="mt-5 text-center text-[12px] leading-relaxed text-stone-400">
        로그인·가입 시{" "}
        <Link href="/terms" className="underline">이용약관</Link> 및{" "}
        <Link href="/privacy" className="underline">개인정보처리방침</Link>에 동의하며,
        불쾌·혐오 콘텐츠와 악성 사용자에 대한{" "}
        <b className="font-semibold text-stone-500">무관용 정책</b>에 동의합니다.
      </p>

      <p className="mt-5 text-center text-sm text-neutral-500">
        아직 계정이 없나요?{" "}
        <Link href="/signup" className="font-semibold text-forest">
          회원가입
        </Link>
      </p>
    </main>
  );
}
