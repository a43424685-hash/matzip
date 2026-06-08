/**
 * RestaurantService — 맛집 등록 / 좋아요 / 저장 / 검색.
 * XP 지급은 전부 XpService.awardXp 를 통하며, 등록 1건은 트랜잭션으로 묶어
 * 전체 XP 와 지역 XP 가 함께 갱신되도록 한다.
 */

import { prisma } from "@/lib/db";
import {
  awardXp,
  likeFromActorAllowed,
  shareFromActorAllowed,
} from "../xp/XpService";

// ─────────────────────────────────────────────────────────────
// 입력 타입
// ─────────────────────────────────────────────────────────────
export interface MediaInput {
  type: "image" | "video";
  url: string;
  thumbnailUrl?: string | null;
  duration?: number | null;
}

export interface CreatePostInput {
  userId: string;
  name: string;
  primaryRegionId: string;
  kakaoPlaceId?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  shortReview?: string | null;
  content?: string | null;
  revisitIntent?: "yes" | "maybe" | "no" | null;
  priceRange?: "under_10k" | "10k_20k" | "20k_40k" | "over_40k" | null;
  waitingLevel?: "none" | "short" | "long" | null;
  categoryIds: string[];
  media: MediaInput[];
}

export interface CreatePostResult {
  postId: string;
  restaurantId: string;
  awardedXp: number;
  regionName: string;
}

// ─────────────────────────────────────────────────────────────
// 맛집 등록
// ─────────────────────────────────────────────────────────────
export async function createRestaurantPost(
  input: CreatePostInput
): Promise<CreatePostResult> {
  const { userId, primaryRegionId } = input;

  const region = await prisma.region.findUnique({
    where: { id: primaryRegionId },
    select: { name: true },
  });
  if (!region) throw new Error("INVALID_REGION");

  return prisma.$transaction(async (tx) => {
    // 1) 음식점 find-or-create
    //    같은 가게 판별: 카카오 장소 ID(있으면) 우선 → 같은 ID면 같은 가게.
    //    ID 없으면(직접 입력) 이름+지역으로 소프트 매칭.
    const placeId = input.kakaoPlaceId?.trim() || null;
    const name = input.name.trim();
    const sel = { id: true, latitude: true, longitude: true };

    let restaurant = placeId
      ? await tx.restaurant.findUnique({ where: { kakaoPlaceId: placeId }, select: sel })
      : await tx.restaurant.findFirst({ where: { name, primaryRegionId }, select: sel });

    if (!restaurant) {
      restaurant = await tx.restaurant.create({
        data: {
          name,
          kakaoPlaceId: placeId,
          primaryRegionId,
          address: input.address ?? null,
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
          createdByUserId: userId,
        },
        select: sel,
      });
    }

    // 기존 음식점에 좌표가 없고 이번에 검색 좌표가 있으면 채워준다 (위치 인증 활성화)
    if (
      restaurant.latitude == null &&
      input.latitude != null &&
      input.longitude != null
    ) {
      await tx.restaurant.update({
        where: { id: restaurant.id },
        data: { latitude: input.latitude, longitude: input.longitude, address: input.address ?? undefined },
      });
    }

    // 동일 음식점에 이 사용자가 이미 등록했는지 (중복 등록 기본 XP 없음)
    const alreadyPosted = await tx.restaurantPost.findFirst({
      where: { restaurantId: restaurant.id, userId },
      select: { id: true },
    });

    // 2) 게시글 생성
    const post = await tx.restaurantPost.create({
      data: {
        restaurantId: restaurant.id,
        userId,
        shortReview: input.shortReview?.trim() || null,
        content: input.content?.trim() || null,
        revisitIntent: input.revisitIntent ?? null,
        priceRange: input.priceRange ?? null,
        waitingLevel: input.waitingLevel ?? null,
      },
      select: { id: true },
    });

    // 3) 미디어
    if (input.media.length > 0) {
      await tx.media.createMany({
        data: input.media.map((m, i) => ({
          postId: post.id,
          type: m.type,
          url: m.url,
          thumbnailUrl: m.thumbnailUrl ?? null,
          duration: m.duration ?? null,
          sortOrder: i,
        })),
      });
    }

    // 4) 카테고리 연결
    const uniqueCats = Array.from(new Set(input.categoryIds));
    if (uniqueCats.length > 0) {
      await tx.restaurantPostCategory.createMany({
        data: uniqueCats.map((categoryId) => ({ postId: post.id, categoryId })),
      });
    }

    // 5) 지역 통계: 새 음식점 기여 시 restaurantCount +1
    if (!alreadyPosted) {
      await tx.userRegionStat.upsert({
        where: { userId_regionId: { userId, regionId: primaryRegionId } },
        create: { userId, regionId: primaryRegionId, restaurantCount: 1 },
        update: { restaurantCount: { increment: 1 } },
      });
    }

    // 6) XP 지급 안 함 — 미인증 등록은 XP 0 (파밍 방지).
    //    기본 기록·콘텐츠(한줄평/리뷰/카테고리/가격·웨이팅·재방문)·사진/영상 XP는
    //    전부 "보류"되고, 위치 인증 성공 시 VerificationService.verifyLocation 에서
    //    한꺼번에 지급된다. (post 의 필드가 보류 XP의 출처 = 멱등 재계산)

    return {
      postId: post.id,
      restaurantId: restaurant.id,
      awardedXp: 0,
      regionName: region.name,
    };
  });
}

// ─────────────────────────────────────────────────────────────
// 좋아요 토글
// ─────────────────────────────────────────────────────────────
export async function toggleLike(
  userId: string,
  postId: string
): Promise<{ liked: boolean; likeCount: number }> {
  return prisma.$transaction(async (tx) => {
    const post = await tx.restaurantPost.findUnique({
      where: { id: postId },
      select: {
        userId: true,
        locationVerified: true,
        restaurant: { select: { primaryRegionId: true } },
      },
    });
    if (!post) throw new Error("POST_NOT_FOUND");

    const existing = await tx.like.findUnique({
      where: { userId_postId: { userId, postId } },
      select: { id: true },
    });

    if (existing) {
      await tx.like.delete({ where: { id: existing.id } });
      const updated = await tx.restaurantPost.update({
        where: { id: postId },
        data: { likeCount: { decrement: 1 } },
        select: { likeCount: true },
      });
      // 정책 18.2: 좋아요 취소해도 이미 지급된 XP 는 회수하지 않음
      return { liked: false, likeCount: updated.likeCount };
    }

    await tx.like.create({ data: { userId, postId } });
    const updated = await tx.restaurantPost.update({
      where: { id: postId },
      data: { likeCount: { increment: 1 } },
      select: { likeCount: true },
    });

    // 작성자에게 XP — 위치 인증된 글만(반응 XP는 인증글 전용), 셀프 제외, 하루 3회 한도, 멱등
    const recipientId = post.userId;
    const regionId = post.restaurant.primaryRegionId;
    if (post.locationVerified && (await likeFromActorAllowed(userId, recipientId, tx))) {
      const res = await awardXp(
        {
          userId: recipientId,
          actorUserId: userId,
          sourceType: "like_received",
          regionId,
          sourceId: postId,
          dedupeKey: `like_received:${postId}:${userId}`,
        },
        tx
      );
      if (res.awarded) {
        await tx.userRegionStat.upsert({
          where: { userId_regionId: { userId: recipientId, regionId } },
          create: { userId: recipientId, regionId, likeReceivedCount: 1 },
          update: { likeReceivedCount: { increment: 1 } },
        });
      }
    }

    return { liked: true, likeCount: updated.likeCount };
  });
}

// ─────────────────────────────────────────────────────────────
// 저장 토글
// ─────────────────────────────────────────────────────────────
export async function toggleSave(
  userId: string,
  restaurantId: string,
  postId?: string | null
): Promise<{ saved: boolean; saveCount: number }> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.save.findUnique({
      where: { userId_restaurantId: { userId, restaurantId } },
      select: { id: true, postId: true },
    });

    if (existing) {
      await tx.save.delete({ where: { id: existing.id } });
      const r = await tx.restaurant.update({
        where: { id: restaurantId },
        data: { saveCount: { decrement: 1 } },
        select: { saveCount: true },
      });
      // 저장 시 함께 올렸던 post.saveCount 도 되돌린다 (피드 카드 vs 상세 숫자 불일치 방지)
      if (existing.postId) {
        await tx.restaurantPost.update({
          where: { id: existing.postId },
          data: { saveCount: { decrement: 1 } },
        });
      }
      return { saved: false, saveCount: r.saveCount };
    }

    await tx.save.create({ data: { userId, restaurantId, postId: postId ?? null } });
    const r = await tx.restaurant.update({
      where: { id: restaurantId },
      data: { saveCount: { increment: 1 } },
      select: { saveCount: true, primaryRegionId: true },
    });

    // 작성자(저장된 post 기준)에게 XP (멱등: 같은 사용자→같은 음식점 1회)
    let authorId: string | null = null;
    let authorPostVerified = false;
    if (postId) {
      const post = await tx.restaurantPost.findUnique({
        where: { id: postId },
        select: { userId: true, locationVerified: true },
      });
      authorId = post?.userId ?? null;
      authorPostVerified = post?.locationVerified ?? false;
      if (authorId) {
        await tx.restaurantPost.update({
          where: { id: postId },
          data: { saveCount: { increment: 1 } },
        });
      }
    }

    // 반응 XP는 위치 인증된 글만
    if (authorId && authorId !== userId && authorPostVerified) {
      const res = await awardXp(
        {
          userId: authorId,
          actorUserId: userId,
          sourceType: "saved_by_user",
          regionId: r.primaryRegionId,
          sourceId: restaurantId,
          dedupeKey: `saved_by_user:${restaurantId}:${userId}`,
        },
        tx
      );
      if (res.awarded) {
        await tx.userRegionStat.upsert({
          where: { userId_regionId: { userId: authorId, regionId: r.primaryRegionId } },
          create: { userId: authorId, regionId: r.primaryRegionId, saveReceivedCount: 1 },
          update: { saveReceivedCount: { increment: 1 } },
        });
      }
    }

    return { saved: true, saveCount: r.saveCount };
  });
}

// ─────────────────────────────────────────────────────────────
// 공유 기록 ("공유 버튼 클릭" 기준)
// ─────────────────────────────────────────────────────────────
export type ShareReason = "OK" | "UNVERIFIED" | "SELF" | "DUPLICATE" | "DAILY_CAP";

export interface ShareResult {
  recorded: boolean; // shareCount 가 올라갔는지 (= 새 공유로 인정)
  awarded: boolean; // 작성자에게 공유 XP 가 지급됐는지
  reason: ShareReason;
  shareCount: number;
}

/**
 * 공유 기록 — 공유 버튼 클릭 시 호출.
 *  - 인증된 글만 (미인증글은 공유 자체가 막혀 있음 — 방어적으로 한 번 더)
 *  - 자기 글 공유는 기록/XP 없음
 *  - 같은 사용자 → 같은 글 1회만: PostShare(user×post 유니크)가 dedupe + shareCount 의 출처
 *  - "공유 기록"과 "XP 상한"은 분리: 하루 공유 XP 상한을 넘겨도 PostShare 기록과 shareCount 는
 *    남기고 XP만 0 (recorded=true, awarded=false, reason=DAILY_CAP)
 *  - 실제 네이티브 공유 성공은 못 잡으므로 "클릭 기록" 기준으로 시작
 */
export async function recordShare(
  actorUserId: string,
  postId: string
): Promise<ShareResult> {
  return prisma.$transaction(async (tx) => {
    const post = await tx.restaurantPost.findUnique({
      where: { id: postId },
      select: {
        userId: true,
        locationVerified: true,
        shareCount: true,
        restaurant: { select: { primaryRegionId: true } },
      },
    });
    if (!post) throw new Error("POST_NOT_FOUND");

    const base = { recorded: false, awarded: false, shareCount: post.shareCount };

    if (!post.locationVerified) return { ...base, reason: "UNVERIFIED" as const };
    if (post.userId === actorUserId) return { ...base, reason: "SELF" as const };

    // dedupe: 이미 이 사용자가 이 글을 공유했으면 기록/카운트/XP 모두 변화 없음
    const existing = await tx.postShare.findUnique({
      where: { userId_postId: { userId: actorUserId, postId } },
      select: { id: true },
    });
    if (existing) return { ...base, reason: "DUPLICATE" as const };

    // 새 고유 공유 → 기록 + shareCount 증가 (XP 상한과 무관하게 항상)
    await tx.postShare.create({ data: { userId: actorUserId, postId } });
    const updated = await tx.restaurantPost.update({
      where: { id: postId },
      data: { shareCount: { increment: 1 } },
      select: { shareCount: true },
    });

    // XP는 하루 상한 이내일 때만 (상한 초과면 기록은 남고 XP만 0)
    if (!(await shareFromActorAllowed(actorUserId, tx))) {
      return { recorded: true, awarded: false, reason: "DAILY_CAP", shareCount: updated.shareCount };
    }

    const res = await awardXp(
      {
        userId: post.userId,
        actorUserId,
        sourceType: "shared",
        regionId: post.restaurant.primaryRegionId,
        sourceId: postId,
        dedupeKey: `shared:${postId}:${actorUserId}`,
      },
      tx
    );
    return { recorded: true, awarded: res.awarded, reason: "OK", shareCount: updated.shareCount };
  });
}

// ─────────────────────────────────────────────────────────────
// 검색
// ─────────────────────────────────────────────────────────────
export type SortKey = "latest" | "saves" | "likes" | "weekly";

export interface SearchInput {
  regionId?: string | null;
  categoryIds?: string[];
  priceRange?: string | null;
  sort?: SortKey;
  limit?: number;
}

export async function searchPosts(input: SearchInput) {
  const { regionId, categoryIds, priceRange, sort = "latest", limit = 50 } = input;

  const where: Record<string, unknown> = {};
  if (regionId) where.restaurant = { primaryRegionId: regionId };
  if (priceRange) where.priceRange = priceRange;
  if (categoryIds && categoryIds.length > 0) {
    where.categories = { some: { categoryId: { in: categoryIds } } };
  }

  const orderBy =
    sort === "saves"
      ? [{ saveCount: "desc" as const }]
      : sort === "likes"
        ? [{ likeCount: "desc" as const }]
        : [{ createdAt: "desc" as const }];

  const posts = await prisma.restaurantPost.findMany({
    where,
    orderBy,
    take: sort === "weekly" ? 200 : limit,
    select: postCardSelect,
  });

  if (sort !== "weekly") return posts.map(toPostCard);

  // 이번 주 인기순: 최근 7일 좋아요+저장(가중) 으로 재정렬
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const ids = posts.map((p) => p.id);
  const [likes, saves] = await Promise.all([
    prisma.like.groupBy({
      by: ["postId"],
      where: { postId: { in: ids }, createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.save.groupBy({
      by: ["postId"],
      where: { postId: { in: ids }, createdAt: { gte: since } },
      _count: { _all: true },
    }),
  ]);
  const lMap = new Map(likes.map((l) => [l.postId, l._count._all]));
  const sMap = new Map(saves.map((s) => [s.postId!, s._count._all]));
  return posts
    .map((p) => ({
      card: toPostCard(p),
      score: (lMap.get(p.id) ?? 0) * 1 + (sMap.get(p.id) ?? 0) * 3,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.card);
}

// 공통 select / 매핑
export const postCardSelect = {
  id: true,
  shortReview: true,
  priceRange: true,
  likeCount: true,
  saveCount: true,
  createdAt: true,
  locationVerified: true,
  photoVerified: true,
  receiptVerified: true,
  menuVerified: true,
  restaurant: {
    select: { id: true, name: true, primaryRegion: { select: { id: true, name: true } } },
  },
  user: { select: { id: true, nickname: true, totalLevel: true } },
  media: { select: { type: true, url: true, thumbnailUrl: true }, orderBy: { sortOrder: "asc" as const }, take: 1 },
  categories: { select: { category: { select: { name: true } } } },
} as const;

type PostRow = Awaited<ReturnType<typeof getOnePost>>;

async function getOnePost(id: string) {
  return prisma.restaurantPost.findUnique({ where: { id }, select: postCardSelect });
}

export function toPostCard(p: NonNullable<PostRow>) {
  return {
    id: p.id,
    shortReview: p.shortReview,
    priceRange: p.priceRange,
    likeCount: p.likeCount,
    saveCount: p.saveCount,
    createdAt: p.createdAt,
    restaurantId: p.restaurant.id,
    restaurantName: p.restaurant.name,
    regionId: p.restaurant.primaryRegion.id,
    regionName: p.restaurant.primaryRegion.name,
    authorId: p.user.id,
    authorNickname: p.user.nickname,
    authorLevel: p.user.totalLevel,
    media: p.media[0] ?? null,
    categories: p.categories.map((c) => c.category.name),
    verification: {
      location: p.locationVerified,
      photo: p.photoVerified,
      receipt: p.receiptVerified,
      menu: p.menuVerified,
    },
  };
}

export type PostCard = ReturnType<typeof toPostCard>;

/** 현재 사용자가 좋아요한 postId / 저장한 restaurantId 집합 (피드 초기 상태용) */
export async function getViewerReactions(
  userId: string | null,
  postIds: string[],
  restaurantIds: string[]
): Promise<{ likedPosts: Set<string>; savedRestaurants: Set<string> }> {
  if (!userId || (postIds.length === 0 && restaurantIds.length === 0)) {
    return { likedPosts: new Set(), savedRestaurants: new Set() };
  }
  const [likes, saves] = await Promise.all([
    prisma.like.findMany({
      where: { userId, postId: { in: postIds } },
      select: { postId: true },
    }),
    prisma.save.findMany({
      where: { userId, restaurantId: { in: restaurantIds } },
      select: { restaurantId: true },
    }),
  ]);
  return {
    likedPosts: new Set(likes.map((l) => l.postId)),
    savedRestaurants: new Set(saves.map((s) => s.restaurantId)),
  };
}
