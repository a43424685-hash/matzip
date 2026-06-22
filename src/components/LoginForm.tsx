"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";

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
        href={returnTo && returnTo !== "/" ? `/api/auth/kakao?returnTo=${encodeURIComponent(returnTo)}` : "/api/auth/kakao"}
        className="flex h-12 w-full items-center justify-center rounded-xl bg-[#FEE500] text-sm font-extrabold text-[#191600]"
      >
        카카오로 시작하기
      </a>

      <p className="mt-6 text-center text-sm text-neutral-500">
        아직 계정이 없나요?{" "}
        <Link href="/signup" className="font-semibold text-forest">
          회원가입
        </Link>
      </p>
    </main>
  );
}
