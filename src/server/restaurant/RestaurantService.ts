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
import { createNotification } from "../notification/NotificationService";

// ─────────────────────────────────────────────────────────────
// 입력 타입
// ─────────────────────────────────────────────────────────────
export interface MediaInput {
  type: "image" | "video";
  url: string;
  thumbnailUrl?: string | null;
  duration?: number | null;
  muted?: boolean;
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
  tasteRating?: string | null;
  tasteTags?: string[];
  serviceRating?: string | null;
  serviceTags?: string[];
  atmosphereTags?: string[];
  revisitIntent?: string | null;
  priceRange?: string | null;
  priceMemo?: string | null;
  waitingLevel?: "none" | "short" | "long" | null;
  visibility?: "public" | "private" | string | null; // 기본 public. "private"이면 나만 보관.
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

    // 2) 게시글 생성 — 운영자(admin) 글은 위치 인증된 것으로 자동 처리
    const isAdmin = (await tx.user.findUnique({ where: { id: userId }, select: { isAdmin: true } }))?.isAdmin ?? false;
    const post = await tx.restaurantPost.create({
      data: {
        restaurantId: restaurant.id,
        userId,
        locationVerified: isAdmin,
        visitedAt: isAdmin ? new Date() : null,
        shortReview: input.shortReview?.trim() || null,
        content: input.content?.trim() || null,
        tasteRating: input.tasteRating ?? null,
        tasteTags: input.tasteTags ?? [],
        serviceRating: input.serviceRating ?? null,
        serviceTags: input.serviceTags ?? [],
        atmosphereTags: input.atmosphereTags ?? [],
        revisitIntent: input.revisitIntent ?? null,
        priceRange: input.priceRange ?? null,
        priceMemo: input.priceMemo?.trim() || null,
        waitingLevel: input.waitingLevel ?? null,
        visibility: input.visibility === "private" ? "private" : "public",
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
          muted: m.type === "video" ? !!m.muted : false,
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
// 내 글 수정 (작성자 본인) — 가게/지역/좌표는 그대로, 내용·카테고리·미디어만 교체
// ─────────────────────────────────────────────────────────────
export interface UpdatePostInput {
  shortReview?: string | null;
  content?: string | null;
  tasteRating?: string | null;
  tasteTags?: string[];
  serviceRating?: string | null;
  serviceTags?: string[];
  atmosphereTags?: string[];
  revisitIntent?: string | null;
  priceRange?: string | null;
  priceMemo?: string | null;
  waitingLevel?: "none" | "short" | "long" | null;
  visibility?: "public" | "private" | string | null; // 기본 public. "private"이면 나만 보관.
  categoryIds: string[];
  media: MediaInput[];
}

export async function updateRestaurantPost(
  userId: string,
  postId: string,
  input: UpdatePostInput
): Promise<{ ok: boolean; reason?: string }> {
  const post = await prisma.restaurantPost.findUnique({
    where: { id: postId },
    select: { userId: true },
  });
  if (!post) return { ok: false, reason: "NOT_FOUND" };
  if (post.userId !== userId) return { ok: false, reason: "FORBIDDEN" };

  await prisma.$transaction(async (tx) => {
    await tx.restaurantPost.update({
      where: { id: postId },
      data: {
        shortReview: input.shortReview?.trim() || null,
        content: input.content?.trim() || null,
        tasteRating: input.tasteRating ?? null,
        tasteTags: input.tasteTags ?? [],
        serviceRating: input.serviceRating ?? null,
        serviceTags: input.serviceTags ?? [],
        atmosphereTags: input.atmosphereTags ?? [],
        revisitIntent: input.revisitIntent ?? null,
        priceRange: input.priceRange ?? null,
        priceMemo: input.priceMemo?.trim() || null,
        waitingLevel: input.waitingLevel ?? null,
      },
    });

    // 카테고리 교체
    await tx.restaurantPostCategory.deleteMany({ where: { postId } });
    const uniqueCats = Array.from(new Set(input.categoryIds));
    if (uniqueCats.length > 0) {
      await tx.restaurantPostCategory.createMany({
        data: uniqueCats.map((categoryId) => ({ postId, categoryId })),
      });
    }

    // 미디어 교체 (배열 순서 = sortOrder → 사진 순서 반영)
    await tx.media.deleteMany({ where: { postId } });
    if (input.media.length > 0) {
      await tx.media.createMany({
        data: input.media.map((m, i) => ({
          postId,
          type: m.type,
          url: m.url,
          thumbnailUrl: m.thumbnailUrl ?? null,
          duration: m.duration ?? null,
          muted: m.type === "video" ? !!m.muted : false,
          sortOrder: i,
        })),
      });
    }
  });

  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// 글 삭제 (작성자 본인 또는 운영자)
// ─────────────────────────────────────────────────────────────
export async function deletePost(
  userId: string,
  postId: string,
  isAdmin = false
): Promise<{ ok: boolean; reason?: string }> {
  const post = await prisma.restaurantPost.findUnique({
    where: { id: postId },
    select: { userId: true },
  });
  if (!post) return { ok: false, reason: "NOT_FOUND" };
  if (post.userId !== userId && !isAdmin) return { ok: false, reason: "FORBIDDEN" };
  // 미디어/카테고리/좋아요/저장/공유/댓글/증거시도/컬렉션항목은 onDelete:Cascade 로 함께 삭제
  await prisma.restaurantPost.delete({ where: { id: postId } });
  // 이 글에 대한 미처리 신고는 처리됨으로
  await prisma.report.updateMany({
    where: { targetType: "post", targetId: postId, status: "open" },
    data: { status: "resolved" },
  });
  return { ok: true };
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

    // 알림: 글 작성자에게 좋아요 알림 (셀프 제외는 서비스 내부 처리)
    await createNotification(tx, { userId: post.userId, actorUserId: userId, type: "like", postId });

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
export type SortKey = "latest" | "saves" | "likes" | "weekly" | "name";
const DEMO_POST_ID_PREFIX = "demo-p";
const DEMO_USER_ID_PREFIX = "demo-u";

export interface SearchInput {
  regionId?: string | null;
  categoryIds?: string[];
  priceRange?: string | null;
  sort?: SortKey;
  limit?: number;
  excludeUserIds?: string[]; // 차단한 사용자 글 제외
  q?: string | null; // 가게 이름 키워드 검색
  coords?: { lat: number; lng: number } | null; // 위치 검색(지오코딩 결과) — 있으면 반경 우선
  radiusKm?: number;
  keywordTerms?: string[]; // 검색어에서 뽑은 분류어(야장·노포 등). 태그뿐 아니라 한줄평/리뷰 글에서도 매칭.
  includeUnverified?: boolean; // true면 미인증 글도 노출(갓 올라온 맛집)
}

export async function searchPosts(input: SearchInput) {
  const { regionId, categoryIds, priceRange, sort = "latest", limit = 50, excludeUserIds, q, coords, radiusKm = 3, keywordTerms, includeUnverified } = input;

  const where: Record<string, unknown> = {};
  const restaurantWhere: Record<string, unknown> = {};
  if (regionId) restaurantWhere.primaryRegionId = regionId;
  // 위치 검색: "강남" 같은 동네는 (1) 좌표 주변 반경 박스 + (2) 가게 이름/주소에 검색어 포함 을 함께(OR) 잡는다.
  // → 좌표가 살짝 떨어져 있어도 이름/주소가 맞으면 검색되어 "0곳" 문제를 막는다.
  const qTrim = q?.trim();
  const geoBox = coords
    ? {
        latitude: { gte: coords.lat - radiusKm / 111, lte: coords.lat + radiusKm / 111 },
        longitude: {
          gte: coords.lng - radiusKm / (111 * Math.cos((coords.lat * Math.PI) / 180)),
          lte: coords.lng + radiusKm / (111 * Math.cos((coords.lat * Math.PI) / 180)),
        },
      }
    : null;
  const textMatch = qTrim
    ? {
        OR: [
          { name: { contains: qTrim, mode: "insensitive" } },
          { address: { contains: qTrim, mode: "insensitive" } },
        ],
      }
    : null;
  if (geoBox && textMatch) {
    restaurantWhere.OR = [geoBox, textMatch];
  } else if (geoBox) {
    Object.assign(restaurantWhere, geoBox);
  } else if (textMatch) {
    Object.assign(restaurantWhere, textMatch);
  }
  if (Object.keys(restaurantWhere).length > 0) where.restaurant = restaurantWhere;
  if (priceRange) where.priceRange = priceRange;
  // 분류 필터: (1) 태그가 달렸거나 (2) 한줄평/리뷰 글에 분류어가 들어있으면 매칭.
  //   → 옛날에 등록돼 태그가 없는 맛집도 글에 "야장" 등이 있으면 검색에 잡힌다.
  const catTerms = keywordTerms ?? [];
  if ((categoryIds && categoryIds.length > 0) || catTerms.length > 0) {
    const catOr: Record<string, unknown>[] = [];
    if (categoryIds && categoryIds.length > 0) {
      catOr.push({ categories: { some: { categoryId: { in: categoryIds } } } });
    }
    for (const w of catTerms) {
      catOr.push({ shortReview: { contains: w, mode: "insensitive" } });
      catOr.push({ content: { contains: w, mode: "insensitive" } });
    }
    where.AND = [{ OR: catOr }];
  }
  if (excludeUserIds && excludeUserIds.length > 0) {
    where.userId = { notIn: excludeUserIds };
  }
  // 공개 범위: "나만 보관(private)" 글은 검색·홈피드 등 공개 발견 화면에서 제외.
  where.visibility = "public";
  // 노출 게이트: 위치 인증된 글만. 단 운영자(admin) 글은 미인증이어도 노출(운영자 맛집).
  // includeUnverified면 게이트 없이 전체 노출(갓 올라온 맛집 — 인증 안 돼도 보임).
  if (!includeUnverified) {
    where.OR = [{ locationVerified: true }, { user: { isAdmin: true } }];
  }
  // 비활성화한 사용자와 프리뷰 시드 데모 계정의 글은 숨김
  where.user = { id: { not: { startsWith: DEMO_USER_ID_PREFIX } }, deactivatedAt: null };

  // 유료/무료 분리: 유료 지도에 '잠긴'(맛보기 아님) 글은 무료 화면(홈·검색·피드)에서 제외
  const lockedItems = await prisma.collectionItem.findMany({
    where: { isPreview: false, postId: { not: null }, collection: { isPaid: true } },
    select: { postId: true },
  });
  const lockedIds = lockedItems.map((l) => l.postId).filter((x): x is string => !!x);
  where.id = {
    not: { startsWith: DEMO_POST_ID_PREFIX },
    ...(lockedIds.length > 0 ? { notIn: lockedIds } : {}),
  };

  const orderBy =
    sort === "saves"
      ? [{ saveCount: "desc" as const }]
      : sort === "likes"
        ? [{ likeCount: "desc" as const }]
        : sort === "name"
          ? [{ restaurant: { name: "asc" as const } }]
          : [{ createdAt: "desc" as const }];

  const posts = await prisma.restaurantPost.findMany({
    where,
    orderBy,
    take: sort === "weekly" ? 200 : limit,
    select: postCardSelect,
  });

  // 이름/주소가 검색어와 맞으면 맨 위로. 예: "수유시장 호떡" 치면 그 가게가 1등,
  // 나머지(수유 근처 다른 맛집)는 아래로. 동점이면 기존 정렬(인기순 등) 유지(안정 정렬).
  if (qTrim) {
    const ql = qTrim.toLowerCase();
    const matchScore = (p: (typeof posts)[number]): number => {
      const name = (p.restaurant?.name ?? "").toLowerCase();
      if (name === ql) return 3; // 완전 일치
      if (name.includes(ql)) return 2; // 이름 포함
      return 0;
    };
    posts.sort((a, b) => matchScore(b) - matchScore(a));
  }

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
  tasteRating: true,
  tasteTags: true,
  serviceRating: true,
  serviceTags: true,
  atmosphereTags: true,
  priceRange: true,
  priceMemo: true,
  likeCount: true,
  saveCount: true,
  createdAt: true,
  locationVerified: true,
  receiptVerified: true,
  menuVerified: true,
  restaurant: {
    select: { id: true, name: true, primaryRegion: { select: { id: true, name: true } } },
  },
  user: { select: { id: true, nickname: true, totalLevel: true, isAdmin: true } },
  media: { select: { type: true, url: true, thumbnailUrl: true, muted: true }, orderBy: { sortOrder: "asc" as const }, take: 1 },
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
    tasteRating: p.tasteRating,
    tasteTags: p.tasteTags,
    serviceRating: p.serviceRating,
    serviceTags: p.serviceTags,
    atmosphereTags: p.atmosphereTags,
    priceRange: p.priceRange,
    priceMemo: p.priceMemo,
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
    isOfficial: p.user.isAdmin, // 운영자 맛집 (피드 노출 허용 + 배지)
    media: p.media[0] ?? null,
    categories: p.categories.map((c) => c.category.name),
    verification: {
      location: p.locationVerified,
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
