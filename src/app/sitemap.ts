import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://matzip-psi-nine.vercel.app";

// 기본 공개 페이지 사이트맵. 맛집 상세 등 동적 URL은 규모 커지면 DB 기반으로 확장.
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ["", "/store", "/rankings", "/community", "/nearby", "/search", "/terms", "/privacy", "/refund"];
  return paths.map((p) => ({
    url: `${siteUrl}${p}`,
    changeFrequency: "daily",
    priority: p === "" ? 1 : 0.6,
  }));
}
