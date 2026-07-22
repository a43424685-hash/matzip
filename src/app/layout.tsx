import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import AppSplash from "@/components/AppSplash";
import NativeAuthBridge from "@/components/NativeAuthBridge";
import ScrollReset from "@/components/ScrollReset";
import SwipeNav from "@/components/SwipeNav";
import XpToastWatcher from "@/components/XpToastWatcher";
import AppDialogs from "@/components/AppDialogs";
import Analytics from "@/components/Analytics";

// 카톡/SNS 공유 미리보기(og:image)가 절대 URL로 잡히도록 사이트 주소 지정
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://matzip-psi-nine.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  // 하위 페이지는 각자 title 을 지정하면 "…· 먹고핀"으로, 없으면 기본값으로 노출
  title: { default: "먹고핀 — 위치 인증 맛집 지도 소셜앱", template: "%s · 먹고핀" },
  description: "먹고 핀 꽂고 — 내 맛집 지도를 키우고 레벨업하는 소셜 맛집 앱",
  manifest: "/manifest.webmanifest",
  // 검색엔진 소유확인 (구글 서치콘솔 / 네이버 서치어드바이저)
  verification: {
    google: "2twZeEECnZrrZnpNE29nqTJhajMR2CAAOtJZVbGjmVI",
    other: { "naver-site-verification": "e6b226153470e2168f06d4142ef907e4ab219d66" },
  },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "먹고핀" },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  openGraph: {
    type: "website",
    siteName: "먹고핀",
    title: "먹고핀",
    description: "먹고 핀 꽂고 — 내 맛집 지도를 키우고 레벨업하는 소셜 맛집 앱",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // 확대 차단(maximumScale:1)은 저시력 사용자 접근성을 해쳐 제거 — 최대 5배 허용
  maximumScale: 5,
  themeColor: "#1f4d3f",
  // 아이폰 홈바 안전영역(env(safe-area-inset-*))이 0이 아닌 실제 값이 되려면 cover 필요
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: 브라우저 확장(Scribe 등)이 html/body 에 주입하는
    // 속성으로 인한 hydration 경고 무시 (앱 코드와 무관)
    <html lang="ko" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {/* 스플래시 깜빡임 방지: 본문이 그려지기 '전에' 실행돼, 이미 본 세션이면
            html.splash-seen 을 달아 CSS로 스플래시를 즉시 숨긴다(재방문 시 스플래시 안 뜸).
            콜드스타트(세션 비어있음)면 클래스 없음 → 서버가 그린 스플래시가 홈을 덮음(홈 번쩍 없음). */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(sessionStorage.getItem('mukgopin-splash-seen')==='1')document.documentElement.classList.add('splash-seen')}catch(e){}",
          }}
        />
        {/* 스플래시는 스크립트 '바로 다음'에 둔다 — 홈(app-shell)보다 먼저 파싱돼
            스트리밍 렌더 중에도 홈이 먼저 그려지는 일이 없다(홈 번쩍 원천 차단). */}
        <AppSplash />
        <Suspense fallback={null}>
          <ScrollReset />
        </Suspense>
        <SwipeNav />
        <Suspense fallback={null}>
          <Analytics />
        </Suspense>
        <XpToastWatcher />
        <AppDialogs />
        <div className="app-shell">{children}</div>
        <BottomNav />
        <NativeAuthBridge />
      </body>
    </html>
  );
}
