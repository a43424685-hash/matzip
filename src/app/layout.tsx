import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import AppSplash from "@/components/AppSplash";
import NativeAuthBridge from "@/components/NativeAuthBridge";
import ScrollReset from "@/components/ScrollReset";
import SwipeNav from "@/components/SwipeNav";
import XpToastWatcher from "@/components/XpToastWatcher";
import Analytics from "@/components/Analytics";

// 카톡/SNS 공유 미리보기(og:image)가 절대 URL로 잡히도록 사이트 주소 지정
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://matzip-psi-nine.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "먹고핀",
  description: "먹고 핀 꽂고 — 내 맛집 지도를 키우고 레벨업하는 소셜 맛집 앱",
  manifest: "/manifest.webmanifest",
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
  maximumScale: 1,
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
        <Suspense fallback={null}>
          <ScrollReset />
        </Suspense>
        <SwipeNav />
        <Suspense fallback={null}>
          <Analytics />
        </Suspense>
        <XpToastWatcher />
        <div className="app-shell">{children}</div>
        <BottomNav />
        <AppSplash />
        <NativeAuthBridge />
      </body>
    </html>
  );
}
