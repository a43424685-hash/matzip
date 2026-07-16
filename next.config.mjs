/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== "production";

const nextConfig = {
  reactStrictMode: true,
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
