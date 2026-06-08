/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: [
    "matziplevelup.loca.lt",
    "*.loca.lt",
    "*.trycloudflare.com",
  ],
  experimental: {
    serverActions: {
      allowedOrigins: [
        "matziplevelup.loca.lt",
        "*.loca.lt",
        "*.trycloudflare.com",
      ],
    },
  },
  // MVP: 외부 이미지 URL을 그대로 허용 (업로드 인프라 대신 URL 입력 사용)
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
