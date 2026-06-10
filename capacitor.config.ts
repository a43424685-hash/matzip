import type { CapacitorConfig } from "@capacitor/cli";

/**
 * 먹고핀 네이티브 앱(Capacitor) 설정.
 * Next.js 서버앱이라 정적 export가 불가 → 네이티브 WebView가 배포된 라이브 주소를 띄운다.
 * (도메인 생기면 server.url 을 그 도메인으로 교체)
 */
const config: CapacitorConfig = {
  appId: "com.codebueok.mukgopin",
  appName: "먹고핀",
  webDir: "capacitor-www",
  server: {
    url: "https://matzip-psi-nine.vercel.app",
    cleartext: false,
  },
  ios: {
    contentInset: "always",
  },
};

export default config;
