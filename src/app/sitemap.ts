import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { eligibleCombos } from "@/server/guide/GuideService";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://matzip-psi-nine.vercel.app";

export const revalidate = 3600;

// 동적 사이트맵 — 정적 페이지 + 주제(guide) + 공개 맛집 + 공개 유료지도.
// 콘텐츠가 늘면 DB에서 자동으로 늘어난다(하드코딩 없음).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPaths = ["", "/store", "/rankings", "/community", "/nearby", "/search", "/guide", "/terms", "/privacy", "/refund"];
  const staticEntries: MetadataRoute.Sitemap = staticPaths.map((p) => ({
    url: `${siteUrl}${p}`,
    changeFrequency: "daily",
    priority: p === "" ? 1 : 0.6,
  }));

  const [combos, posts, collections] = await Promise.all([
    eligibleCombos().catch(() => []),
    prisma.restaurantPost
      .findMany({
        where: { visibility: "public", OR: [{ locationVerified: true }, { isOperatorPick: true }] },
        select: { id: true, updatedAt: true },
        take: 5000,
        orderBy: { updatedAt: "desc" },
      })
      .catch(() => []),
    prisma.collection
      .findMany({ where: { isPublic: true }, select: { id: true, updatedAt: true }, take: 2000, orderBy: { updatedAt: "desc" } })
      .catch(() => []),
  ]);

  const guideEntries: MetadataRoute.Sitemap = combos.map((c) => ({
    url: `${siteUrl}/guide/${encodeURIComponent(c.regionSlug)}/${encodeURIComponent(c.situationSlug)}`,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const postEntries: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${siteUrl}/restaurants/${p.id}`,
    lastModified: p.updatedAt,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  const collectionEntries: MetadataRoute.Sitemap = collections.map((c) => ({
    url: `${siteUrl}/collections/${c.id}`,
    lastModified: c.updatedAt,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  return [...staticEntries, ...guideEntries, ...postEntries, ...collectionEntries];
}
