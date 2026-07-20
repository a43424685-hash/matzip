/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== "production";

// 전역 보안 응답 헤더 — 앱이 실제 쓰는 기능(위치·카메라)은 self 허용해 깨지지 않게.
// CSP는 카카오맵·GA·Supabase·OAuth 도메인 검토가 필요해 여기선 제외(추후 report-only부터).
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(self), microphone=(), payment=()" },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // x-powered-by: Next.js 노출 제거
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  // 로컬 터널(loca.lt 등)은 개발에서만 허용 — 운영에 넣으면 누구나 만들 수 있는
  // 터널 도메인이 Server Action CSRF 방어(Origin 검증)를 우회하는 구멍이 된다.
  ...(isDev
    ? {
        allowedDevOrigins: ["matziplevelup.loca.lt", "*.loca.lt", "*.trycloudflare.com"],
        experimental: {
          serverActions: {
            allowedOrigins: ["matziplevelup.loca.lt", "*.loca.lt", "*.trycloudflare.com"],
          },
        },
      }
    : {}),
  // 이미지 최적화 원격 호스트 — 전면 허용(**)은 /_next/image를 SSRF 프록시로
  // 악용할 수 있어 실제 사용하는 저장소 도메인만 허용한다.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "*.kakaocdn.net" },
      { protocol: "https", hostname: "matzip-psi-nine.vercel.app" },
    ],
  },
};

export default nextConfig;
