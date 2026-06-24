/**
 * CollectionService — 맛집 컬렉션(리스트) 생성/항목 관리/조회.
 * "내 성수 맛집 10곳" 같은 큐레이션을 만들고 공유하는 기반.
 * (XP/랭킹과는 무관 — 순수 큐레이션 자산)
 */

import { prisma } from "@/lib/db";
import { sendWebPush } from "@/server/push/PushService";

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
    select: { userId: true, isPaid: true },
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

  // 유료 지도면 구매자에게 "지도 업데이트" 알림 (안 읽은 동일 알림 있으면 중복 생성 안 함 → 무더기 추가해도 1건)
  if (col.isPaid) {
    void notifyMapBuyersOfUpdate(collectionId).catch(() => {});
  }
  return { added: true };
}

/** 유료 지도에 맛집이 추가됐을 때 구매자에게 알림(미열람 map_update 중복 방지) + 웹푸시 */
async function notifyMapBuyersOfUpdate(collectionId: string): Promise<void> {
  const [col, buyers] = await Promise.all([
    prisma.collection.findUnique({ where: { id: collectionId }, select: { title: true } }),
    prisma.mapPurchase.findMany({ where: { collectionId, status: "paid" }, select: { buyerId: true } }),
  ]);
  if (!col || buyers.length === 0) return;
  for (const b of buyers) {
    const dup = await prisma.notification.findFirst({
      where: { userId: b.buyerId, type: "map_update", collectionId, read: false },
      select: { id: true },
    });
    if (dup) continue;
    await prisma.notification.create({
      data: { userId: b.buyerId, type: "map_update", collectionId },
    });
    void sendWebPush(b.buyerId, {
      title: "구매한 지도가 업데이트됐어요",
      body: `《${col.title}》에 새 맛집이 추가됐어요`,
      url: `/collections/${collectionId}`,
    }).catch(() => {});
  }
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

export interface PickerRestaurant {
  restaurantId: string;
  name: string;
  regionName: string;
  source: string; // 등록 | 저장
  verified: boolean; // 내가 위치 인증한 맛집인지
  inCollection: boolean;
}

/** 리스트 편집용: 내가 등록/저장한 맛집 + 인증여부 + 이 리스트 포함 여부 (리스트 안에서 골라 담기) */
export async function getMyRestaurantsForPicker(
  userId: string,
  collectionId: string
): Promise<PickerRestaurant[]> {
  const [posts, saves, items, verifiedPosts] = await Promise.all([
    prisma.restaurantPost.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { restaurant: { select: { id: true, name: true, primaryRegion: { select: { name: true } } } } },
    }),
    prisma.save.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { restaurant: { select: { id: true, name: true, primaryRegion: { select: { name: true } } } } },
    }),
    prisma.collectionItem.findMany({ where: { collectionId }, select: { restaurantId: true } }),
    prisma.restaurantPost.findMany({
      where: { userId, locationVerified: true },
      select: { restaurantId: true },
    }),
  ]);
  const inSet = new Set(items.map((i) => i.restaurantId));
  const verifiedSet = new Set(verifiedPosts.map((p) => p.restaurantId));
  const seen = new Set<string>();
  const out: PickerRestaurant[] = [];
  const push = (r: { id: string; name: string; primaryRegion: { name: string } }, source: string) => {
    if (seen.has(r.id)) return;
    seen.add(r.id);
    out.push({
      restaurantId: r.id,
      name: r.name,
      regionName: r.primaryRegion.name,
      source,
      verified: verifiedSet.has(r.id),
      inCollection: inSet.has(r.id),
    });
  };
  for (const p of posts) push(p.restaurant, "등록");
  for (const s of saves) push(s.restaurant, "저장");
  return out;
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
  return cols.map((c) => {
    const cover = c.items.map((i) => i.post?.media[0]).find((m) => m && m.type === "image");
    return {
      id: c.id,
      title: c.title,
      isPublic: c.isPublic,
      itemCount: c._count.items,
      previewNames: c.items.map((i) => i.restaurant.name),
      // 56px 썸네일 자리엔 작은 썸네일(400px) 우선 — 큰 원본(1600px) 안 받게
      coverMedia: cover?.thumbnailUrl ?? cover?.url ?? null,
    };
  });
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
      user: { select: { nickname: true, totalLevel: true, isAdmin: true } },
      _count: { select: { items: true } },
      items: {
        orderBy: { sortOrder: "asc" },
        select: {
          isPreview: true,
          note: true,
          restaurant: {
            select: { id: true, name: true, latitude: true, longitude: true, primaryRegion: { select: { name: true } } },
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
    const mp = await prisma.mapPurchase.findUnique({
      where: { buyerId_collectionId: { buyerId: viewerId, collectionId } },
      select: { status: true },
    });
    purchased = mp?.status === "paid"; // 환불(refunded)되면 접근 회수
  }
  // 유료인데 소유자도 구매자도 아니면 잠금(미리보기 블러)
  const locked = col.isPaid && !isOwner && !purchased;

  // 접근 가능한 뷰어(소유자/구매자)의 방문·저장 상태 (도장깨기·저장 버튼 초기값)
  let visitedIds: string[] = [];
  let savedIds: string[] = [];
  if (viewerId && !locked) {
    const restaurantIds = col.items.map((i) => i.restaurant.id);
    const [visits, saves] = await Promise.all([
      prisma.collectionVisit.findMany({
        where: { userId: viewerId, collectionId },
        select: { restaurantId: true },
      }),
      restaurantIds.length > 0
        ? prisma.save.findMany({
            where: { userId: viewerId, restaurantId: { in: restaurantIds } },
            select: { restaurantId: true },
          })
        : Promise.resolve([]),
    ]);
    visitedIds = visits.map((v) => v.restaurantId);
    savedIds = saves.map((s) => s.restaurantId);
  }

  // 지역별 맛집 개수 (잠금 상태에서도 보여줄 teaser)
  const regionMap = new Map<string, number>();
  for (const i of col.items) {
    const r = i.restaurant.primaryRegion.name;
    regionMap.set(r, (regionMap.get(r) ?? 0) + 1);
  }
  const regionCounts = [...regionMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // 판매자 신뢰 지표(일반인도 데이터로) + 이 지도의 인증 집계
  const ownerVerifiedTotal = await prisma.restaurantPost.count({
    where: { userId: col.userId, locationVerified: true },
  });
  const verifyStats = {
    total: col._count.items,
    location: col.items.filter((i) => i.post?.locationVerified).length,
    proof: col.items.filter((i) => i.post?.receiptVerified || i.post?.menuVerified).length,
  };

  // 지도 티저용 핀 — 잠긴 가게는 좌표를 흐려(약 ±300m) 정확 위치를 숨긴다(결정적 오프셋).
  const seedOf = (s: string) => [...s].reduce((a, c) => a + c.charCodeAt(0), 0);
  const jitter = (v: number, seed: number) => v + (((seed * 9301 + 49297) % 233280) / 233280 - 0.5) * 0.006;
  const mapPins = col.items
    .filter((i) => i.restaurant.latitude != null && i.restaurant.longitude != null)
    .map((i) => {
      const lockedItem = locked && !i.isPreview;
      const seed = seedOf(i.restaurant.id);
      return {
        lat: lockedItem ? jitter(i.restaurant.latitude as number, seed) : (i.restaurant.latitude as number),
        lng: lockedItem ? jitter(i.restaurant.longitude as number, seed + 31) : (i.restaurant.longitude as number),
        locked: lockedItem,
      };
    });

  // 잠긴 맛집 티저 — 사진·카테고리만(이름·위치·후기 비공개)
  const lockedTeasers = locked
    ? col.items
        .filter((i) => !i.isPreview)
        .map((i) => ({ media: i.post?.media[0] ?? null, categories: i.post?.categories.map((c) => c.category.name) ?? [] }))
    : [];

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
    visitedIds,
    savedIds,
    ownerId: col.userId,
    ownerNickname: col.user.nickname,
    ownerLevel: col.user.totalLevel,
    ownerIsAdmin: col.user.isAdmin,
    ownerVerifiedTotal,
    verifyStats,
    regionName: col.region.name,
    itemCount: col._count.items,
    previewCount: col.items.filter((i) => i.isPreview).length,
    mapPins,
    lockedTeasers,
    // 잠금 상태면 '맛보기'로 지정된 가게만 노출(나머지는 숨김 — 이름·위치 유출 방지)
    items: (locked ? col.items.filter((i) => i.isPreview) : col.items).map((i) => ({
      restaurantId: i.restaurant.id,
      restaurantName: i.restaurant.name,
      latitude: i.restaurant.latitude,
      longitude: i.restaurant.longitude,
      regionName: i.restaurant.primaryRegion.name,
      isPreview: i.isPreview,
      note: i.note ?? null,
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

/** 컬렉션 전체 열람 권한 (소유자이거나, 무료 공개이거나, 유료를 구매한 경우) */
export async function hasCollectionAccess(userId: string, collectionId: string): Promise<boolean> {
  const col = await prisma.collection.findUnique({
    where: { id: collectionId },
    select: { userId: true, isPaid: true },
  });
  if (!col) return false;
  if (col.userId === userId) return true;
  if (!col.isPaid) return true;
  const bought = await prisma.mapPurchase.findUnique({
    where: { buyerId_collectionId: { buyerId: userId, collectionId } },
    select: { status: true },
  });
  return bought?.status === "paid";
}

/** 지도 방문 도장 토글 (열람 권한 있는 가게만) */
export async function toggleVisit(
  userId: string,
  collectionId: string,
  restaurantId: string,
  visited: boolean
): Promise<{ ok: boolean; reason?: string; visited?: boolean }> {
  if (!(await hasCollectionAccess(userId, collectionId))) return { ok: false, reason: "NO_ACCESS" };
  // 해당 가게가 이 컬렉션에 실제로 담겨 있는지 확인
  const item = await prisma.collectionItem.findUnique({
    where: { collectionId_restaurantId: { collectionId, restaurantId } },
    select: { id: true },
  });
  if (!item) return { ok: false, reason: "NOT_IN_MAP" };

  if (visited) {
    await prisma.collectionVisit.upsert({
      where: { userId_collectionId_restaurantId: { userId, collectionId, restaurantId } },
      create: { userId, collectionId, restaurantId },
      update: {},
    });
  } else {
    await prisma.collectionVisit.deleteMany({ where: { userId, collectionId, restaurantId } });
  }
  return { ok: true, visited };
}

// ─────────────────────────────────────────────────────────────
// 유료 지도 판매
// ─────────────────────────────────────────────────────────────
export const PAID_MAP_MIN_WON = 990;
export const PAID_MAP_MAX_WON = 9900;

// 유료 지도 판매 자격 (출시 초반 허들 — 마켓이 살아나도록 낮게, 이후 상향 가능)
export const SELL_MIN_LEVEL = 20;
export const SELL_MIN_VERIFIED = 30;
export const SELL_MIN_PROOF = 5; // 위 30곳 중 영수증/메뉴 인증 포함 최소 개수
// 유료 지도 '맛보기' — 구매 전 무료로 보이는 가게 수 (판매자가 직접 선택)
export const PAID_MAP_PREVIEW_COUNT = 5;

export interface SellerEligibility {
  level: number;
  verifiedCount: number; // 위치 인증 맛집 수
  proofCount: number; // 그중 영수증/메뉴 인증 포함 수
  isAdmin: boolean;
  eligible: boolean;
}

/** 유료 지도 판매 자격 상태 (Lv.20 + 위치 인증 30곳 + 그중 영수증/메뉴 5곳). 운영자는 항상 통과. */
export async function getSellerEligibility(userId: string): Promise<SellerEligibility> {
  const [user, verifiedCount, proofCount] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { totalLevel: true, isAdmin: true } }),
    prisma.restaurantPost.count({ where: { userId, locationVerified: true } }),
    prisma.restaurantPost.count({
      where: { userId, locationVerified: true, OR: [{ receiptVerified: true }, { menuVerified: true }] },
    }),
  ]);
  const level = user?.totalLevel ?? 1;
  const isAdmin = !!user?.isAdmin;
  const eligible =
    !!user &&
    (isAdmin ||
      (level >= SELL_MIN_LEVEL && verifiedCount >= SELL_MIN_VERIFIED && proofCount >= SELL_MIN_PROOF));
  return { level, verifiedCount, proofCount, isAdmin, eligible };
}

/** 유료 지도 판매 자격 (boolean) */
export async function canSellPaidMaps(userId: string): Promise<boolean> {
  return (await getSellerEligibility(userId)).eligible;
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
  // 유료 지도는 '내가 인증한 맛집'만 담을 수 있다 — 미인증 항목이 하나라도 있으면 거부
  const items = await prisma.collectionItem.findMany({ where: { collectionId }, select: { restaurantId: true } });
  const restIds = items.map((i) => i.restaurantId);
  const verified = await prisma.restaurantPost.findMany({
    where: { userId, locationVerified: true, restaurantId: { in: restIds } },
    select: { restaurantId: true },
    distinct: ["restaurantId"],
  });
  const verifiedSet = new Set(verified.map((v) => v.restaurantId));
  if (restIds.some((id) => !verifiedSet.has(id))) return { ok: false, reason: "NEED_VERIFIED" };
  // 맛보기(무료 공개) 가게를 정확히 PAID_MAP_PREVIEW_COUNT(5)곳 지정해야 유료 오픈 가능 (최소=최대)
  const previewCount = await prisma.collectionItem.count({ where: { collectionId, isPreview: true } });
  if (previewCount !== PAID_MAP_PREVIEW_COUNT) return { ok: false, reason: "NEED_PREVIEW" };
  const price = Math.round(priceWon ?? 0);
  if (price < PAID_MAP_MIN_WON || price > PAID_MAP_MAX_WON) return { ok: false, reason: "BAD_PRICE" };

  await prisma.collection.update({
    where: { id: collectionId },
    data: { isPaid: true, priceWon: price, isPublic: true },
  });
  return { ok: true };
}

/** 맛보기(무료 공개) 지정/해제 — 소유자만. 현재 맛보기 개수를 반환. */
export async function setItemPreview(
  userId: string,
  collectionId: string,
  restaurantId: string,
  isPreview: boolean
): Promise<{ ok: boolean; reason?: string; previewCount?: number }> {
  const col = await prisma.collection.findUnique({
    where: { id: collectionId },
    select: { userId: true },
  });
  if (!col) return { ok: false, reason: "NOT_FOUND" };
  if (col.userId !== userId) return { ok: false, reason: "FORBIDDEN" };
  // 맛보기는 최대 PAID_MAP_PREVIEW_COUNT(5)곳까지만 — 이미 5곳이면 추가 거부
  if (isPreview) {
    const current = await prisma.collectionItem.count({ where: { collectionId, isPreview: true } });
    const already = await prisma.collectionItem.findUnique({
      where: { collectionId_restaurantId: { collectionId, restaurantId } },
      select: { isPreview: true },
    });
    if (!already?.isPreview && current >= PAID_MAP_PREVIEW_COUNT) {
      return { ok: false, reason: "PREVIEW_FULL", previewCount: current };
    }
  }
  await prisma.collectionItem
    .update({
      where: { collectionId_restaurantId: { collectionId, restaurantId } },
      data: { isPreview },
    })
    .catch(() => {});
  const previewCount = await prisma.collectionItem.count({ where: { collectionId, isPreview: true } });
  return { ok: true, previewCount };
}

/** 맛집별 큐레이터 '추천 이유' 메모 저장 — 소유자만 (최대 60자) */
export async function setItemNote(
  userId: string,
  collectionId: string,
  restaurantId: string,
  note: string
): Promise<{ ok: boolean; reason?: string }> {
  const col = await prisma.collection.findUnique({
    where: { id: collectionId },
    select: { userId: true },
  });
  if (!col) return { ok: false, reason: "NOT_FOUND" };
  if (col.userId !== userId) return { ok: false, reason: "FORBIDDEN" };
  const trimmed = note.trim().slice(0, 60);
  await prisma.collectionItem
    .update({
      where: { collectionId_restaurantId: { collectionId, restaurantId } },
      data: { note: trimmed || null },
    })
    .catch(() => {});
  return { ok: true };
}

export interface CollectionSearchResult {
  id: string;
  title: string;
  regionName: string;
  isPaid: boolean;
  priceWon: number | null;
  itemCount: number;
  ownerId: string;
  ownerNickname: string;
  ownerLevel: number;
  ownerIsAdmin: boolean;
  thumbnailUrl: string | null;
}

/** 검색(지역+상황+키워드)에 맞는 공개 큐레이션 지도 — 크리에이터 신뢰(레벨/경험치)순. */
export async function searchCollections(input: {
  regionId?: string | null;
  categoryIds?: string[];
  q?: string;
  excludeUserIds?: string[];
}): Promise<CollectionSearchResult[]> {
  const { regionId, categoryIds = [], q = "", excludeUserIds = [] } = input;
  // 멀티 단어 검색: "강남 맛집" → [강남] (흔한 말 '맛집/지도' 제외) → 제목에 토큰 하나라도 포함되면 매칭
  const STOP = new Set(["맛집", "맛집지도", "지도", "추천", "리스트", "맛집추천", "맛집리스트"]);
  const tokens = q.trim().split(/\s+/).filter((t) => t.length > 0 && !STOP.has(t));
  const cols = await prisma.collection.findMany({
    where: {
      isPublic: true,
      ...(regionId ? { regionId } : {}),
      ...(tokens.length ? { OR: tokens.map((t) => ({ title: { contains: t, mode: "insensitive" as const } })) } : {}),
      ...(categoryIds.length
        ? { items: { some: { post: { categories: { some: { categoryId: { in: categoryIds } } } } } } }
        : {}),
      ...(excludeUserIds.length ? { userId: { notIn: excludeUserIds } } : {}),
    },
    select: {
      id: true,
      title: true,
      isPaid: true,
      priceWon: true,
      region: { select: { name: true } },
      user: { select: { id: true, nickname: true, totalLevel: true, totalXp: true, isAdmin: true } },
      _count: { select: { items: true } },
      items: {
        take: 1,
        orderBy: { sortOrder: "asc" },
        select: { post: { select: { media: { take: 1, orderBy: { sortOrder: "asc" }, select: { url: true, thumbnailUrl: true } } } } },
      },
    },
    take: 40,
  });

  // 신뢰순 = 크리에이터 랭킹 순서(레벨→경험치). fallback: 고랭커 없어도 매칭된 지도 다 노출.
  cols.sort((a, b) => b.user.totalLevel - a.user.totalLevel || b.user.totalXp - a.user.totalXp);
  return cols.slice(0, 12).map((c) => ({
    id: c.id,
    title: c.title,
    regionName: c.region.name,
    isPaid: c.isPaid,
    priceWon: c.priceWon,
    itemCount: c._count.items,
    ownerId: c.user.id,
    ownerNickname: c.user.nickname,
    ownerLevel: c.user.totalLevel,
    ownerIsAdmin: c.user.isAdmin,
    thumbnailUrl: c.items[0]?.post?.media[0]?.thumbnailUrl ?? c.items[0]?.post?.media[0]?.url ?? null,
  }));
}
