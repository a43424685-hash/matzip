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
  authorIsOfficial: boolean;
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
      user: { deactivatedAt: null },
      ...(excludeUserIds.length > 0 ? { userId: { notIn: excludeUserIds } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      title: true,
      user: { select: { nickname: true, totalLevel: true, isAdmin: true } },
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
    authorIsOfficial: c.user.isAdmin,
    itemCount: c._count.items,
    previewNames: c.items.map((i) => i.restaurant.name),
    coverUrl:
      c.items.map((i) => i.post?.media[0]).find(Boolean)?.thumbnailUrl ??
      c.items.map((i) => i.post?.media[0]).find(Boolean)?.url ??
      null,
  }));
}

export interface PaidMapCard {
  id: string;
  title: string;
  priceWon: number;
  regionName: string;
  authorNickname: string;
  itemCount: number;
  coverUrl: string | null;
}

/** 판매 중인 유료 맛집 지도 (홈 스토어 섹션 + 가격 노출용) */
export async function getPaidMaps(
  limit: number,
  excludeUserIds: string[] = []
): Promise<PaidMapCard[]> {
  const cols = await prisma.collection.findMany({
    where: {
      isPaid: true,
      isPublic: true,
      items: { some: {} },
      user: { deactivatedAt: null },
      ...(excludeUserIds.length > 0 ? { userId: { notIn: excludeUserIds } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      title: true,
      priceWon: true,
      region: { select: { name: true } },
      user: { select: { nickname: true } },
      _count: { select: { items: true } },
      items: {
        orderBy: { sortOrder: "asc" },
        take: 1,
        select: {
          post: { select: { media: { where: { type: "image" }, take: 1, select: { url: true, thumbnailUrl: true } } } },
        },
      },
    },
  });
  return cols.map((c) => ({
    id: c.id,
    title: c.title,
    priceWon: c.priceWon ?? 0,
    regionName: c.region.name,
    authorNickname: c.user.nickname,
    itemCount: c._count.items,
    coverUrl: c.items[0]?.post?.media[0]?.thumbnailUrl ?? c.items[0]?.post?.media[0]?.url ?? null,
  }));
}

/** 홈 '내가 찜한 맛집' 미리보기 (로그인 사용자) */
export async function getMySavedPreview(viewerId: string, limit: number): Promise<PostCard[]> {
  const rows = await prisma.save.findMany({
    where: { userId: viewerId, postId: { not: null } },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { post: { select: postCardSelect } },
  });
  return rows
    .map((s) => s.post)
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map(toPostCard);
}

export async function getHomeData(viewerId?: string | null) {
  const blockedIds = await getBlockedIds(viewerId ?? null);
  const [weekly, recent, saved, topUsers, categories, myPostCount] = await Promise.all([
    searchPosts({ sort: "weekly", limit: 8, excludeUserIds: blockedIds }),
    // 갓 올라온 맛집 — 미인증 포함, 최신순
    searchPosts({ sort: "latest", limit: 8, excludeUserIds: blockedIds, includeUnverified: true }),
    viewerId ? getMySavedPreview(viewerId, 10) : Promise.resolve([] as PostCard[]),
    getOverallUserRankingCached(5),
    getActiveCategories(),
    viewerId ? prisma.restaurantPost.count({ where: { userId: viewerId } }) : Promise.resolve(0),
  ]);
  return {
    weekly: weekly as PostCard[],
    recent: recent as PostCard[],
    saved,
    myPostCount,
    // 차단한 사용자는 랭킹에서 제외 (캐시는 전역, 표시 시 뷰어별 필터)
    topUsers: blockedIds.length > 0 ? topUsers.filter((u) => !blockedIds.includes(u.userId)) : topUsers,
    categories,
  };
}
