import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://matzip-psi-nine.vercel.app";
// 프로덕션 배포만 색인. 미리보기(ranking-redesign 등) 배포는 색인 금지 —
// 미리보기 URL이 검색에 잡혀 프로덕션과 중복되는 것 방지.
const isProduction = process.env.VERCEL_ENV === "production" || !process.env.VERCEL_ENV;

export default function robots(): MetadataRoute.Robots {
  if (!isProduction) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // 공개 콘텐츠(홈·guide·맛집·지도·랭킹·커뮤니티)는 허용, 로그인·관리자·API·개인영역은 차단
      disallow: ["/api/", "/admin/", "/me/", "/login", "/signup", "/onboarding", "/suspended"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
