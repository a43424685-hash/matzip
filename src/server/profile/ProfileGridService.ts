/**
 * 프로필 그리드(내 글/인증 탭) 페이지네이션. /me·/u 공통.
 * 소유자 본인은 전체(비공개 포함), 남이 보면 공개 + 유료지도 잠금 제외.
 */
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { visiblePostWhere } from "@/server/visibility/PaidVisibility";

export type ProfileGridTab = "posts" | "verified";

export interface GridItem {
  id: string;
  name: string;
  thumb: string | null; // 대표 썸네일(없으면 null → 플레이스홀더)
  verified: boolean;
  pick: boolean;
}

export const PROFILE_GRID_PAGE = 30;

export async function getProfileGrid(
  targetUserId: string,
  viewerId: string | null,
  tab: ProfileGridTab,
  skip: number,
  take: number = PROFILE_GRID_PAGE
): Promise<GridItem[]> {
  const isOwner = viewerId === targetUserId;

  const where: Prisma.RestaurantPostWhereInput = { userId: targetUserId };
  if (!isOwner) where.visibility = "public"; // 남이 보면 공개 글만
  if (tab === "verified") where.locationVerified = true;
  // 유료 잠금 글 제외 — 중앙 정책(소유자/구매자/관리자는 봄). 서브쿼리로 처리.
  where.AND = [await visiblePostWhere(viewerId)];

  const rows = await prisma.restaurantPost.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip,
    take,
    select: {
      id: true,
      locationVerified: true,
      isOperatorPick: true,
      restaurant: { select: { name: true } },
      media: { take: 1, orderBy: { sortOrder: "asc" }, select: { url: true, thumbnailUrl: true, type: true } },
    },
  });

  return rows.map((p) => {
    const m = p.media[0];
    const thumb = m ? m.thumbnailUrl || (m.type === "video" ? null : m.url) || null : null;
    return {
      id: p.id,
      name: p.restaurant.name,
      thumb,
      verified: p.locationVerified,
      pick: p.isOperatorPick,
    };
  });
}
