/**
 * CollectionService — 맛집 컬렉션(리스트) 생성/항목 관리/조회.
 * "내 성수 맛집 10곳" 같은 큐레이션을 만들고 공유하는 기반.
 * (XP/랭킹과는 무관 — 순수 큐레이션 자산)
 */

import { prisma } from "@/lib/db";

const mediaPick = { select: { type: true, url: true, thumbnailUrl: true }, orderBy: { sortOrder: "asc" as const }, take: 1 };

export interface CreateCollectionInput {
  userId: string;
  title: string;
  description?: string | null;
  regionId: string; // 대표 지역 필수
  isPublic?: boolean;
}

export async function createCollection(input: CreateCollectionInput) {
  return prisma.collection.create({
    data: {
      userId: input.userId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      regionId: input.regionId,
      isPublic: input.isPublic ?? true,
    },
    select: { id: true },
  });
}

/** 음식점의 대표 게시글(썸네일/한줄평용) — 미디어 있는 최신 글 우선 */
async function pickRepresentativePost(restaurantId: string): Promise<string | null> {
  const withMedia = await prisma.restaurantPost.findFirst({
    where: { restaurantId, media: { some: {} } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (withMedia) return withMedia.id;
  const any = await prisma.restaurantPost.findFirst({
    where: { restaurantId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return any?.id ?? null;
}

/** 컬렉션에 음식점 담기/빼기 토글 (소유자만) */
export async function toggleItem(
  userId: string,
  collectionId: string,
  restaurantId: string
): Promise<{ added: boolean }> {
  const col = await prisma.collection.findUnique({
    where: { id: collectionId },
    select: { userId: true },
  });
  if (!col || col.userId !== userId) throw new Error("FORBIDDEN");

  const existing = await prisma.collectionItem.findUnique({
    where: { collectionId_restaurantId: { collectionId, restaurantId } },
    select: { id: true },
  });
  if (existing) {
    await prisma.collectionItem.delete({ where: { id: existing.id } });
    return { added: false };
  }

  const count = await prisma.collectionItem.count({ where: { collectionId } });
  const postId = await pickRepresentativePost(restaurantId);
  await prisma.collectionItem.create({
    data: { collectionId, restaurantId, postId, sortOrder: count },
  });
  return { added: true };
}

/** 내 컬렉션 목록 (+ 특정 음식점 포함 여부 — 담기 피커용) */
export async function listMyCollections(userId: string, restaurantId?: string) {
  const cols = await prisma.collection.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      isPublic: true,
      _count: { select: { items: true } },
    },
  });

  let memberSet = new Set<string>();
  if (restaurantId) {
    const items = await prisma.collectionItem.findMany({
      where: { restaurantId, collection: { userId } },
      select: { collectionId: true },
    });
    memberSet = new Set(items.map((i) => i.collectionId));
  }

  return cols.map((c) => ({
    id: c.id,
    title: c.title,
    isPublic: c.isPublic,
    itemCount: c._count.items,
    hasRestaurant: memberSet.has(c.id),
  }));
}

/** 내 지도용: 컬렉션 + 미리보기(맛집 이름 3개, 커버 미디어) */
export async function getMyCollectionsWithPreview(userId: string) {
  const cols = await prisma.collection.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      isPublic: true,
      _count: { select: { items: true } },
      items: {
        orderBy: { sortOrder: "asc" },
        take: 3,
        select: {
          restaurant: { select: { name: true } },
          post: { select: { media: mediaPick } },
        },
      },
    },
  });
  return cols.map((c) => ({
    id: c.id,
    title: c.title,
    isPublic: c.isPublic,
    itemCount: c._count.items,
    previewNames: c.items.map((i) => i.restaurant.name),
    coverMedia: c.items.map((i) => i.post?.media[0]).find((m) => m && m.type === "image")?.url ?? null,
  }));
}

/** 컬렉션 상세 (공유/공개 페이지용). 유료 지도면 비구매자는 잠금(블러). */
export async function getCollectionDetail(collectionId: string, viewerId?: string | null) {
  const col = await prisma.collection.findUnique({
    where: { id: collectionId },
    select: {
      id: true,
      title: true,
      description: true,
      isPublic: true,
      isPaid: true,
      priceWon: true,
      userId: true,
      createdAt: true,
      region: { select: { name: true } },
      user: { select: { nickname: true, totalLevel: true } },
      _count: { select: { items: true } },
      items: {
        orderBy: { sortOrder: "asc" },
        select: {
          restaurant: {
            select: { id: true, name: true, primaryRegion: { select: { name: true } } },
          },
          post: {
            select: {
              id: true,
              shortReview: true,
              media: mediaPick,
              categories: { select: { category: { select: { name: true } } }, take: 3 },
              locationVerified: true,
              receiptVerified: true,
              menuVerified: true,
            },
          },
        },
      },
    },
  });
  if (!col) return null;

  const isOwner = !!viewerId && viewerId === col.userId;
  let purchased = false;
  if (viewerId && col.isPaid && !isOwner) {
    purchased = !!(await prisma.mapPurchase.findUnique({
      where: { buyerId_collectionId: { buyerId: viewerId, collectionId } },
      select: { id: true },
    }));
  }
  // 유료인데 소유자도 구매자도 아니면 잠금(미리보기 블러)
  const locked = col.isPaid && !isOwner && !purchased;

  // 지역별 맛집 개수 (잠금 상태에서도 보여줄 teaser)
  const regionMap = new Map<string, number>();
  for (const i of col.items) {
    const r = i.restaurant.primaryRegion.name;
    regionMap.set(r, (regionMap.get(r) ?? 0) + 1);
  }
  const regionCounts = [...regionMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return {
    id: col.id,
    title: col.title,
    description: col.description,
    isPublic: col.isPublic,
    isPaid: col.isPaid,
    priceWon: col.priceWon,
    isOwner,
    purchased,
    locked,
    regionCounts,
    ownerId: col.userId,
    ownerNickname: col.user.nickname,
    ownerLevel: col.user.totalLevel,
    regionName: col.region.name,
    itemCount: col._count.items,
    // 잠금 상태면 항목 자체를 내려주지 않음 (이름·위치 유출 방지)
    items: locked
      ? []
      : col.items.map((i) => ({
      restaurantId: i.restaurant.id,
      restaurantName: i.restaurant.name,
      regionName: i.restaurant.primaryRegion.name,
      postId: i.post?.id ?? null,
      shortReview: i.post?.shortReview ?? null,
      media: i.post?.media[0] ?? null,
      categories: i.post?.categories.map((c) => c.category.name) ?? [],
      verification: {
        location: i.post?.locationVerified ?? false,
        receipt: i.post?.receiptVerified ?? false,
        menu: i.post?.menuVerified ?? false,
      },
    })),
  };
}

export type CollectionDetail = NonNullable<Awaited<ReturnType<typeof getCollectionDetail>>>;

// ─────────────────────────────────────────────────────────────
// 유료 지도 판매
// ─────────────────────────────────────────────────────────────
export const PAID_MAP_MIN_WON = 990;
export const PAID_MAP_MAX_WON = 9900;

/** 유료 지도 판매 자격 (Lv.50 + 위치 인증 100곳) */
export async function canSellPaidMaps(userId: string): Promise<boolean> {
  const [user, verifiedCount] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { totalLevel: true } }),
    prisma.restaurantPost.count({ where: { userId, locationVerified: true } }),
  ]);
  return !!user && user.totalLevel >= 50 && verifiedCount >= 100;
}

/** 컬렉션을 유료 지도로 전환/해제 (소유자 + 자격 + 가격 990~9900). 유료면 공개로 강제. */
export async function setPaidMap(
  userId: string,
  collectionId: string,
  isPaid: boolean,
  priceWon: number | null
): Promise<{ ok: boolean; reason?: string }> {
  const col = await prisma.collection.findUnique({
    where: { id: collectionId },
    select: { userId: true, _count: { select: { items: true } } },
  });
  if (!col) return { ok: false, reason: "NOT_FOUND" };
  if (col.userId !== userId) return { ok: false, reason: "FORBIDDEN" };

  if (!isPaid) {
    await prisma.collection.update({
      where: { id: collectionId },
      data: { isPaid: false, priceWon: null },
    });
    return { ok: true };
  }

  if (!(await canSellPaidMaps(userId))) return { ok: false, reason: "NOT_ELIGIBLE" };
  if (col._count.items < 1) return { ok: false, reason: "EMPTY" };
  const price = Math.round(priceWon ?? 0);
  if (price < PAID_MAP_MIN_WON || price > PAID_MAP_MAX_WON) return { ok: false, reason: "BAD_PRICE" };

  await prisma.collection.update({
    where: { id: collectionId },
    data: { isPaid: true, priceWon: price, isPublic: true },
  });
  return { ok: true };
}
