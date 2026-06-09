/**
 * 홈 화면 전용 데이터 조립 (UI 리디자인용 — XP/인증/DB 로직 변경 없음).
 * 5개 섹션: 이번 주 인기 / 내 주변 인증 / (카테고리) / 추천 리스트 / 맛잘알 랭킹
 */
import { prisma } from "@/lib/db";
import {
  searchPosts,
  postCardSelect,
  toPostCard,
  type PostCard,
} from "@/server/restaurant/RestaurantService";
import { getOverallUserRankingCached } from "@/server/ranking/RankingService";
import { getActiveCategories } from "@/server/catalog";
import { getBlockedIds } from "@/server/block/BlockService";

export interface HomeCollection {
  id: string;
  title: string;
  authorNickname: string;
  authorLevel: number;
  itemCount: number;
  previewNames: string[];
  coverUrl: string | null;
}

export async function getPublicCollections(
  limit: number,
  excludeUserIds: string[] = []
): Promise<HomeCollection[]> {
  const cols = await prisma.collection.findMany({
    where: {
      isPublic: true,
      items: { some: {} },
      ...(excludeUserIds.length > 0 ? { userId: { notIn: excludeUserIds } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      title: true,
      user: { select: { nickname: true, totalLevel: true } },
      _count: { select: { items: true } },
      items: {
        orderBy: { sortOrder: "asc" },
        take: 3,
        select: {
          restaurant: { select: { name: true } },
          post: { select: { media: { where: { type: "image" }, take: 1, select: { url: true, thumbnailUrl: true } } } },
        },
      },
    },
  });
  return cols.map((c) => ({
    id: c.id,
    title: c.title,
    authorNickname: c.user.nickname,
    authorLevel: c.user.totalLevel,
    itemCount: c._count.items,
    previewNames: c.items.map((i) => i.restaurant.name),
    coverUrl:
      c.items.map((i) => i.post?.media[0]).find(Boolean)?.thumbnailUrl ??
      c.items.map((i) => i.post?.media[0]).find(Boolean)?.url ??
      null,
  }));
}

export async function getHomeData(viewerId?: string | null) {
  const blockedIds = await getBlockedIds(viewerId ?? null);
  const [weekly, verified, collections, topUsers, categories] = await Promise.all([
    searchPosts({ sort: "weekly", limit: 8, excludeUserIds: blockedIds }),
    prisma.restaurantPost
      .findMany({
        where: {
          OR: [{ locationVerified: true }, { user: { isAdmin: true } }],
          ...(blockedIds.length > 0 ? { userId: { notIn: blockedIds } } : {}),
        },
        orderBy: [{ visitedAt: "desc" }, { createdAt: "desc" }],
        take: 8,
        select: postCardSelect,
      })
      .then((rows) => rows.map(toPostCard)),
    getPublicCollections(8, blockedIds),
    getOverallUserRankingCached(5),
    getActiveCategories(),
  ]);
  return {
    weekly: weekly as PostCard[],
    verified,
    collections,
    // 차단한 사용자는 랭킹에서 제외 (캐시는 전역, 표시 시 뷰어별 필터)
    topUsers: blockedIds.length > 0 ? topUsers.filter((u) => !blockedIds.includes(u.userId)) : topUsers,
    categories,
  };
}
