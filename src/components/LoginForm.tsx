"use client";

import { type FormEvent, useState, useEffect } from "react";
import Link from "next/link";
import { isNativeApp, getPlatform, nativeAppleLogin, nativeKakaoLogin, nativeGoogleLogin } from "@/lib/nativeAuth";
import { markSplashSeen } from "@/components/AppSplash";

export default function LoginForm({ error, returnTo: rawReturn = "" }: { error?: string; returnTo?: string }) {
  // 오픈 리다이렉트 방지: 내부 절대경로(/foo)만 허용
  const returnTo = rawReturn.startsWith("/") && !rawReturn.startsWith("//") ? rawReturn : "/";
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // 플랫폼별 소셜 버튼: iOS=애플, 안드로이드=구글 (SSR 하이드레이션 위해 마운트 후 결정)
  const [platform, setPlatform] = useState<"ios" | "android" | "web">("web");
  useEffect(() => setPlatform(getPlatform()), []);
  const isAndroid = platform === "android";

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
      markSplashSeen(); // 로그인 후 홈에선 스플래시 안 뜨게 (콜드스타트에서만)
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
        <h1 className="sr-only">먹고핀 로그인</h1>
        <p className="text-[34px] leading-none" aria-hidden="true">
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
          <p className="mt-1.5 text-[12px] text-stone-400">
            비밀번호를 잊으셨다면 아래 <b className="text-ink-muted">카카오로 시작하기</b>로 로그인하거나, 고객문의로 알려주세요.
          </p>
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

      {!isAndroid && (
      <a
        href={returnTo && returnTo !== "/" ? `/api/auth/apple?returnTo=${encodeURIComponent(returnTo)}` : "/api/auth/apple"}
        onClick={(e) => {
          markSplashSeen(); // 로그인 후 홈에선 스플래시 생략
          if (isNativeApp()) {
            e.preventDefault();
            nativeAppleLogin().then((r) => {
              if (!r.ok && r.error && r.error !== "canceled") {
                setMessage(`Apple 로그인 실패: ${r.error}`);
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
      )}

      {isAndroid && (
      <button
        type="button"
        onClick={() => {
          markSplashSeen(); // 로그인 후 홈에선 스플래시 생략
          nativeGoogleLogin().then((r) => {
            if (!r.ok && r.error && r.error !== "canceled") {
              setMessage(`구글 로그인 실패: ${r.error}`);
            }
          });
        }}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white text-sm font-extrabold text-[#1f1f1f]"
      >
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        </svg>
        Google로 로그인
      </button>
      )}

      <a
        href={returnTo && returnTo !== "/" ? `/api/auth/kakao?returnTo=${encodeURIComponent(returnTo)}` : "/api/auth/kakao"}
        onClick={(e) => {
          markSplashSeen(); // 로그인 후 홈에선 스플래시 생략
          if (isNativeApp()) {
            e.preventDefault();
            nativeKakaoLogin().then((r) => {
              if (!r.ok && r.error && r.error !== "canceled") {
                setMessage(`카카오 로그인 실패: ${r.error}`);
              }
            });
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
