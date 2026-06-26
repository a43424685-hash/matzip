// 네이티브 앱(Capacitor) 여부 + 소셜 로그인을 Safari View Controller로 여는 헬퍼.
// 웹에서는 isNativeApp()이 false라 기존 <a href> 흐름을 그대로 쓴다.

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
}

export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  return !!cap?.isNativePlatform?.();
}

// 카카오 로그인을 인앱 Safari(SFSafariViewController)로 연다.
// (임베디드 WebView는 카카오가 막지만, Safari View Controller는 허용)
export async function openNativeLogin(provider: "apple" | "kakao"): Promise<void> {
  const { Browser } = await import("@capacitor/browser");
  await Browser.open({
    url: `${window.location.origin}/api/auth/${provider}?native=1`,
    presentationStyle: "popover",
  });
}

// Apple은 네이티브 시트(iOS 기본 로그인 창)로 처리 — 사파리 안 뜸.
// 토큰을 JS가 직접 받아 서버에서 검증 → 같은 WebView에 세션 쿠키 발급.
export async function nativeAppleLogin(): Promise<{ ok: boolean; error?: string }> {
  try {
    const { SignInWithApple } = await import("@capacitor-community/apple-sign-in");
    const result = await SignInWithApple.authorize({
      clientId: "com.codebueok.mukgopin",
      redirectURI: `${window.location.origin}/api/auth/apple/callback`,
      scopes: "email name",
    });
    const identityToken = result.response?.identityToken;
    if (!identityToken) return { ok: false, error: "no_token" };

    const res = await fetch("/api/auth/apple/native", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identityToken }),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (res.ok && data.ok) {
      window.location.href = "/";
      return { ok: true };
    }
    return { ok: false, error: data.error || "server" };
  } catch (e) {
    // 사용자가 취소하면 여기로 옴 (에러 아님)
    const msg = e instanceof Error ? e.message : String(e);
    if (/cancel|1001/i.test(msg)) return { ok: false, error: "canceled" };
    return { ok: false, error: msg || "failed" };
  }
}

// 카카오는 네이티브 SDK(카톡앱)로 로그인 → accessToken을 서버에서 검증 → 세션.
export async function nativeKakaoLogin(): Promise<{ ok: boolean; error?: string }> {
  try {
    const { KakaoLoginPlugin } = await import("capacitor-kakao-login-plugin");
    const res = await KakaoLoginPlugin.goLogin();
    const accessToken = res?.accessToken;
    if (!accessToken) return { ok: false, error: "no_token" };

    const r = await fetch("/api/auth/kakao/native", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken }),
    });
    const data = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (r.ok && data.ok) {
      window.location.href = "/";
      return { ok: true };
    }
    return { ok: false, error: data.error || "server" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/cancel/i.test(msg)) return { ok: false, error: "canceled" };
    return { ok: false, error: msg || "failed" };
  }
}
