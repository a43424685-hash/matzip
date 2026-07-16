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
    // 로그인(Apple·카카오) OAuth를 외부 브라우저가 아닌 앱 내 WebView에서 진행
    // → App Store 가이드라인 4 (인앱 로그인) 준수
    // OAuth 도메인만 허용. *.kakao.com 와일드카드는 금지 —
    // map.kakao.com 등이 앱 WebView 안에서 열려 돌아올 수 없게 되는 문제.
    // 외부 지도 링크는 openExternal()(인앱 사파리/커스텀탭)로 연다.
    allowNavigation: [
      "appleid.apple.com",
      "*.apple.com",
      "kauth.kakao.com",
      "accounts.kakao.com",
      "logins.daum.net",
    ],
  },
  ios: {
    // 안전영역은 CSS(env(safe-area-inset-*))로만 처리 → 위쪽 빈 공간/바운스 어색함 해결
    // (로그인 안 되던 건 contentInset이 아니라 OAuth WebView 차단 문제였음 — 확인됨)
    contentInset: "never",
  },
};

export default config;
