"use client";

import { useEffect } from "react";
import { isNativeApp } from "@/lib/nativeAuth";

// 네이티브 앱에서 소셜 로그인 완료 후 mukgopin://auth?token=... 딥링크로 돌아오면,
// 인앱 Safari를 닫고 토큰을 /api/auth/exchange 로 보내 WebView에 세션 쿠키를 발급받는다.
export default function NativeAuthBridge() {
  useEffect(() => {
    if (!isNativeApp()) return;

    let remove: (() => void) | undefined;

    (async () => {
      const { App } = await import("@capacitor/app");
      const { Browser } = await import("@capacitor/browser");

      const handle = await App.addListener("appUrlOpen", async ({ url }) => {
        if (!url || !url.startsWith("mukgopin://auth")) return;
        try {
          await Browser.close();
        } catch {
          /* 이미 닫혔을 수 있음 */
        }
        const query = url.split("?")[1] ?? "";
        const token = new URLSearchParams(query).get("token");
        if (token) {
          window.location.href = `${window.location.origin}/api/auth/exchange?token=${encodeURIComponent(token)}`;
        }
      });
      remove = () => handle.remove();
    })();

    return () => {
      if (remove) remove();
    };
  }, []);

  return null;
}
