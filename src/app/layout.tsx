import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import AppSplash from "@/components/AppSplash";

export const metadata: Metadata = {
  title: "먹고핀",
  description: "먹고 핀 꽂고 — 내 맛집 지도를 키우고 레벨업하는 소셜 맛집 앱",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: 브라우저 확장(Scribe 등)이 html/body 에 주입하는
    // 속성으로 인한 hydration 경고 무시 (앱 코드와 무관)
    <html lang="ko" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <div className="app-shell">{children}</div>
        <BottomNav />
        <AppSplash />
      </body>
    </html>
  );
}
