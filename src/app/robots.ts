import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://matzip-psi-nine.vercel.app";

// 검색엔진 크롤링 규칙 — 공개 콘텐츠는 허용, 로그인·관리자·API·개인영역은 차단
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/admin/", "/me/", "/login", "/signup", "/onboarding", "/suspended"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
