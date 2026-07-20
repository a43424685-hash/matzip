/**
 * SEO 주제 페이지("지역 × 상황 맛집") 데이터.
 *
 * 원칙(중요):
 *  - 진짜 데이터만. AI가 영업시간·존재 여부 등 지어내지 않는다.
 *  - 페이지 대상 = 공개(public) + (방문 위치인증 OR 운영자 PICK).
 *    운영자 PICK은 다이닝코드·방송 리스트 등 실제 맛집 큐레이션이라 '실데이터'다.
 *  - 맛집 3곳 미만 조합은 페이지를 만들지 않는다(thin content 방지).
 */
import { prisma } from "@/lib/db";
import { toPostCard, postCardSelect } from "@/server/restaurant/RestaurantService";

export const GUIDE_MIN_POSTS = 3; // 이 수 미만이면 페이지 생성 안 함

/** SEO 노출 대상 글 조건 — 공개 + (방문 인증 OR 운영자 PICK) */
export const guidePostWhere = {
  visibility: "public" as const,
  OR: [{ locationVerified: true }, { isOperatorPick: true }],
};

// ── 슬러그 ↔ 이름 변환 ──
// 지역명은 공백이 없어 그대로 사용(서울/경남/전북…). 상황명은 공백을 '-'로.
export const regionToSlug = (name: string) => name.trim();
export const slugToRegion = (slug: string) => decodeURIComponent(slug).trim();
export const situationToSlug = (name: string) => name.trim().replace(/\s+/g, "-");
export const slugToSituation = (slug: string) => decodeURIComponent(slug).replace(/-/g, " ").trim();

/** 활성 '상황' 카테고리 목록 */
export function listSituations() {
  return prisma.category.findMany({
    where: { type: "situation", isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });
}

/** 활성 지역 목록 */
export function listRegions() {
  return prisma.region.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });
}

export interface GuideCombo {
  regionName: string;
  situationName: string;
  regionSlug: string;
  situationSlug: string;
  count: number;
}

/**
 * 3곳 이상인 (지역 × 상황) 조합 전부 — 페이지 생성/사이트맵용.
 * 콘텐츠가 늘면 여기 결과가 저절로 늘어난다(하드코딩 없음).
 */
export async function eligibleCombos(): Promise<GuideCombo[]> {
  const [regions, situations] = await Promise.all([listRegions(), listSituations()]);
  const out: GuideCombo[] = [];
  for (const r of regions) {
    for (const s of situations) {
      const count = await prisma.restaurantPost.count({
        where: {
          ...guidePostWhere,
          restaurant: { primaryRegionId: r.id },
          categories: { some: { categoryId: s.id } },
        },
      });
      if (count >= GUIDE_MIN_POSTS) {
        out.push({
          regionName: r.name,
          situationName: s.name,
          regionSlug: regionToSlug(r.name),
          situationSlug: situationToSlug(s.name),
          count,
        });
      }
    }
  }
  return out;
}

export interface GuidePageData {
  regionName: string;
  situationName: string;
  count: number;
  cards: ReturnType<typeof toPostCard>[];
  related: GuideCombo[]; // 같은 지역의 다른 상황 (내부 링크)
}

/**
 * 한 주제 페이지 데이터. 3곳 미만이면 null(호출부에서 notFound).
 */
export async function getGuidePage(regionName: string, situationName: string): Promise<GuidePageData | null> {
  const [region, situation] = await Promise.all([
    prisma.region.findFirst({ where: { name: regionName, isActive: true }, select: { id: true, name: true } }),
    prisma.category.findFirst({ where: { name: situationName, type: "situation", isActive: true }, select: { id: true, name: true } }),
  ]);
  if (!region || !situation) return null;

  const rows = await prisma.restaurantPost.findMany({
    where: {
      ...guidePostWhere,
      restaurant: { primaryRegionId: region.id },
      categories: { some: { categoryId: situation.id } },
    },
    orderBy: [{ locationVerified: "desc" }, { likeCount: "desc" }, { createdAt: "desc" }],
    take: 60,
    select: postCardSelect,
  });
  if (rows.length < GUIDE_MIN_POSTS) return null;

  // 같은 지역의 다른 상황 페이지(3곳 이상)만 관련 링크로
  const situations = await listSituations();
  const related: GuideCombo[] = [];
  for (const s of situations) {
    if (s.id === situation.id) continue;
    const c = await prisma.restaurantPost.count({
      where: { ...guidePostWhere, restaurant: { primaryRegionId: region.id }, categories: { some: { categoryId: s.id } } },
    });
    if (c >= GUIDE_MIN_POSTS) {
      related.push({
        regionName: region.name,
        situationName: s.name,
        regionSlug: regionToSlug(region.name),
        situationSlug: situationToSlug(s.name),
        count: c,
      });
    }
  }

  return {
    regionName: region.name,
    situationName: situation.name,
    count: rows.length,
    cards: rows.map(toPostCard),
    related,
  };
}
