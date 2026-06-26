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

// Apple/카카오 로그인을 인앱 Safari(SFSafariViewController)로 연다.
// (임베디드 WebView는 Apple·카카오가 막지만, Safari View Controller는 허용)
export async function openNativeLogin(provider: "apple" | "kakao"): Promise<void> {
  const { Browser } = await import("@capacitor/browser");
  await Browser.open({
    url: `${window.location.origin}/api/auth/${provider}?native=1`,
    presentationStyle: "popover",
  });
}
