// 네이티브 앱(Capacitor) 여부 + 소셜 로그인을 Safari View Controller로 여는 헬퍼.
// 웹에서는 isNativeApp()이 false라 기존 <a href> 흐름을 그대로 쓴다.
import { markSplashSeen } from "@/components/AppSplash";

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
}

export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  return !!cap?.isNativePlatform?.();
}

// 'ios' | 'android' | 'web' — 플랫폼별 로그인 버튼 노출에 사용.
export function getPlatform(): "ios" | "android" | "web" {
  if (typeof window === "undefined") return "web";
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  const p = cap?.getPlatform?.();
  return p === "ios" || p === "android" ? p : "web";
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
    const { registerPlugin } = await import("@capacitor/core");
    const AppleLogin = registerPlugin<{ login: () => Promise<{ identityToken: string }> }>("AppleLogin");
    const result = await AppleLogin.login();
    const identityToken = result?.identityToken;
    if (!identityToken) return { ok: false, error: "no_token" };

    const res = await fetch("/api/auth/apple/native", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identityToken }),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (res.ok && data.ok) {
      markSplashSeen(); // 로그인 후 홈에선 스플래시 안 뜨게 (콜드스타트에서만)
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
// iOS는 앱에 직접 넣은 커스텀 플러그인("KakaoLogin")이 Kakao SDK를 호출.
export async function nativeKakaoLogin(): Promise<{ ok: boolean; error?: string }> {
  try {
    const { registerPlugin } = await import("@capacitor/core");
    const KakaoLogin = registerPlugin<{ login: () => Promise<{ accessToken: string }> }>("KakaoLogin");
    const res = await KakaoLogin.login();
    const accessToken = res?.accessToken;
    if (!accessToken) return { ok: false, error: "no_token" };

    const r = await fetch("/api/auth/kakao/native", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken }),
    });
    const data = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (r.ok && data.ok) {
      markSplashSeen(); // 로그인 후 홈에선 스플래시 안 뜨게 (콜드스타트에서만)
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

// 구글은 안드로이드 Credential Manager로 idToken 받음 → 서버 검증 → 세션.
// 앱에 직접 넣은 커스텀 플러그인("GoogleLogin")을 호출.
export async function nativeGoogleLogin(): Promise<{ ok: boolean; error?: string }> {
  try {
    const { registerPlugin } = await import("@capacitor/core");
    const GoogleLogin = registerPlugin<{ login: () => Promise<{ idToken: string }> }>("GoogleLogin");
    const res = await GoogleLogin.login();
    const idToken = res?.idToken;
    if (!idToken) return { ok: false, error: "no_token" };

    const r = await fetch("/api/auth/google/native", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    const data = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (r.ok && data.ok) {
      markSplashSeen(); // 로그인 후 홈에선 스플래시 안 뜨게 (콜드스타트에서만)
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

// 외부 링크(카카오맵·구글맵 등)를 연다.
// 네이티브에선 window.open이 앱 내 WebView로 열려 돌아올 방법이 없으므로
// SFSafariViewController/Custom Tab(닫기 버튼 있음)으로 연다. 웹은 새 탭.
export function openExternal(url: string): void {
  if (isNativeApp()) {
    import("@capacitor/browser").then(({ Browser }) => Browser.open({ url }));
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
