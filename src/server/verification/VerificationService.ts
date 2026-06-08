/**
 * VerificationService — 방문 인증 캡처.
 * 인증은 "이 유저의 해당 맛집 기록(RestaurantPost)"에 귀속된다.
 *
 * 신뢰 정책:
 *  - 위치 인증(강): 가게 좌표가 있어야만 가능. 50m 이내 + GPS 정확도 50m 이내. 좌표 없으면 불가.
 *    (좌표가 없다고 첫 인증자의 위치로 가게를 만들지 않는다 — 어뷰징 방지)
 *  - 사진/영수증/메뉴판: URL 첨부. 위치 인증된 글이면 *Verified 뱃지를 켜고 XP를 지급한다.
 *
 * XP 정책 (확정):
 *  - 미인증 등록은 XP 0. 기록·콘텐츠·첨부 XP는 전부 "보류".
 *  - 위치 인증 성공 시 보류 XP를 일괄 해제(post 필드가 출처, dedupeKey로 멱등).
 *  - 위치 인증 후 추가 첨부는 즉시 지급, 미인증 글이면 계속 보류.
 *  - 반응(좋아요/저장/공유) XP는 인증글에만 (RestaurantService).
 */

import { prisma } from "@/lib/db";
import { awardXp } from "../xp/XpService";
import { ABUSE_LIMITS } from "../xp/xpRules";

function ymd(d = new Date()): string {
  return `${d.getFullYear()}${d.getMonth() + 1}${d.getDate()}`;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export type ProofKindGate = "photo" | "receipt" | "menu";

/**
 * 증거 인증 시도 게이트 — AI 호출 "전에" 검사. (비용/어뷰징 상한)
 *  - 유저 하루 시도 상한, 글-슬롯(post×kind) 시도 상한 (실패 포함 카운트)
 */
export async function checkProofGate(
  userId: string,
  postId: string,
  kind: ProofKindGate
): Promise<{ allowed: boolean; reason?: string }> {
  const dayCount = await prisma.proofAttempt.count({
    where: { userId, createdAt: { gte: startOfToday() } },
  });
  if (dayCount >= ABUSE_LIMITS.proofAttemptsPerUserPerDay) {
    return { allowed: false, reason: "오늘 인증 시도 한도를 초과했어요. 내일 다시 시도해주세요." };
  }
  const slotCount = await prisma.proofAttempt.count({ where: { postId, kind } });
  if (slotCount >= ABUSE_LIMITS.proofAttemptsPerSlot) {
    return { allowed: false, reason: "이 항목은 인증 시도 횟수를 초과했어요." };
  }
  return { allowed: true };
}

/** 시도 1건 기록(기본 ok=false). AI 호출 전에 만들어 실패도 카운트되게 한다. */
export async function recordProofAttempt(
  userId: string,
  postId: string,
  kind: ProofKindGate
): Promise<string> {
  const a = await prisma.proofAttempt.create({ data: { userId, postId, kind } });
  return a.id;
}

/** 시도 결과 표시 (성공 시 ok=true). */
export async function markProofAttempt(id: string, ok: boolean): Promise<void> {
  await prisma.proofAttempt.update({ where: { id }, data: { ok } }).catch(() => {});
}

// 위치 인증 기준 (타이트). "근처 다른 가게"에서 인증되면 안 되므로 50m + 정확도 50m 하드 제한.
export const LOCATION_THRESHOLD_METERS = 50; // 가게 50m 이내
export const LOCATION_ACCURACY_LIMIT_METERS = 50; // GPS 정확도 50m 이내 (초과 시 재시도)

/** 두 좌표 간 거리(m) — Haversine */
export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

async function loadOwnedPost(userId: string, postId: string) {
  const post = await prisma.restaurantPost.findUnique({
    where: { id: postId },
    select: {
      userId: true,
      visitedAt: true,
      locationVerified: true,
      foodOrPlacePhotoUrl: true,
      receiptPhotoUrl: true,
      menuPhotoUrl: true,
      restaurant: {
        select: { id: true, latitude: true, longitude: true, primaryRegionId: true },
      },
    },
  });
  if (!post) throw new Error("POST_NOT_FOUND");
  if (post.userId !== userId) throw new Error("FORBIDDEN"); // 본인 기록만 인증
  return post;
}

export type LocationVerifyReason =
  | "OK"
  | "NO_COORDS" // 가게 좌표가 없어 위치 인증 불가
  | "LOW_ACCURACY" // GPS 정확도가 기준 초과 → 재시도
  | "TOO_FAR"; // 가게에서 너무 멀리 떨어짐

export interface LocationVerifyResult {
  verified: boolean;
  reason: LocationVerifyReason;
  distanceMeters: number | null;
  accuracyMeters: number | null;
  thresholdMeters: number; // 허용 거리(미니맵 원 표시용)
  accuracyLimitMeters: number;
  awardedXp?: number; // 위치 인증으로 해제된 총 XP (성공 시)
}

/**
 * 위치 인증 — 가게 좌표 기준 50m 이내 + GPS 정확도 50m 이내.
 */
export async function verifyLocation(
  userId: string,
  postId: string,
  input: { lat: number; lng: number; accuracy?: number | null }
): Promise<LocationVerifyResult> {
  const post = await loadOwnedPost(userId, postId);
  const accuracy = input.accuracy ?? null;
  const base = {
    thresholdMeters: LOCATION_THRESHOLD_METERS,
    accuracyLimitMeters: LOCATION_ACCURACY_LIMIT_METERS,
    accuracyMeters: accuracy,
  };

  // 1) 가게 좌표 없으면 위치 인증 불가 (부트스트랩 금지)
  if (post.restaurant.latitude == null || post.restaurant.longitude == null) {
    return { verified: false, reason: "NO_COORDS", distanceMeters: null, ...base };
  }

  // 2) GPS 정확도가 기준(50m) 초과면 재시도 요구
  if (accuracy != null && accuracy > LOCATION_ACCURACY_LIMIT_METERS) {
    return { verified: false, reason: "LOW_ACCURACY", distanceMeters: null, ...base };
  }

  // 3) 거리 검증 — 50m 이내
  const dist = distanceMeters(
    post.restaurant.latitude,
    post.restaurant.longitude,
    input.lat,
    input.lng
  );
  if (dist > LOCATION_THRESHOLD_METERS) {
    return { verified: false, reason: "TOO_FAR", distanceMeters: dist, ...base };
  }

  // 위치 인증 성공 — 보류돼 있던 "기록/콘텐츠" XP를 일괄 해제 (트랜잭션, 멱등)
  // 증거(사진/영수증/메뉴판) XP는 여기서 주지 않는다 — 인증 후 현장 카메라 촬영 시 attachPhoto 에서 지급.
  const awardedXp = await prisma.$transaction(async (tx) => {
    const rich = await tx.restaurantPost.findUnique({
      where: { id: postId },
      select: {
        visitedAt: true,
        shortReview: true,
        content: true,
        priceRange: true,
        waitingLevel: true,
        revisitIntent: true,
        restaurant: { select: { primaryRegionId: true } },
        _count: { select: { categories: true } },
      },
    });
    if (!rich) throw new Error("POST_NOT_FOUND");

    const regionId = rich.restaurant.primaryRegionId;

    await tx.restaurantPost.update({
      where: { id: postId },
      data: {
        locationVerified: true,
        verifiedLatitude: input.lat,
        verifiedLongitude: input.lng,
        verificationDistanceMeters: dist,
        locationAccuracyMeters: accuracy,
        visitedAt: rich.visitedAt ?? new Date(),
      },
    });

    const award = (
      sourceType: Parameters<typeof awardXp>[0]["sourceType"],
      dedupeKey: string
    ) => awardXp({ userId, sourceType, regionId, sourceId: postId, dedupeKey }, tx);

    // 인증 본체 + 오늘 첫 인증
    await award("location_verified", `location_verified:${postId}`);
    await award("daily_first_verify", `daily_first_verify:${userId}:${ymd()}`);

    // 보류됐던 기록/콘텐츠 (post 필드 기준)
    await award("post_created", `post_created:${postId}`);
    if (rich.shortReview) await award("short_review", `short_review:${postId}`);
    if (rich.content) await award("detail_review", `detail_review:${postId}`);
    if (rich._count.categories >= 3) await award("categories", `categories:${postId}`);
    if (rich.priceRange) await award("price", `price:${postId}`);
    if (rich.waitingLevel) await award("waiting", `waiting:${postId}`);
    if (rich.revisitIntent) await award("revisit", `revisit:${postId}`);

    // 지역 인증 마일스톤 (이 글 포함 카운트)
    const verifiedInRegion = await tx.restaurantPost.count({
      where: { userId, locationVerified: true, restaurant: { primaryRegionId: regionId } },
    });
    if (verifiedInRegion === 5)
      await award("region_5_verified", `region_5_verified:${userId}:${regionId}`);
    if (verifiedInRegion === 10)
      await award("region_10_verified", `region_10_verified:${userId}:${regionId}`);

    const sum = await tx.xpEvent.aggregate({
      where: { userId, sourceId: postId },
      _sum: { xpAmount: true },
    });
    return sum._sum.xpAmount ?? 0;
  });

  return { verified: true, reason: "OK", distanceMeters: dist, awardedXp, ...base };
}

export type PhotoKind = "photo" | "receipt" | "menu";

const PHOTO_SOURCE: Record<PhotoKind, Parameters<typeof awardXp>[0]["sourceType"]> = {
  photo: "photo_added",
  receipt: "receipt_verified",
  menu: "menu_verified",
};

/**
 * 사진 첨부 — 음식·현장 / 영수증 / 메뉴판.
 * 위치 인증된 글이면: URL 저장 + *Verified 뱃지 ON + 해당 XP 즉시 지급(+풀인증 재확인).
 * 미인증 글이면: URL 저장만(XP 보류). 위치 인증 시 일괄 해제된다.
 */
export async function attachPhoto(
  userId: string,
  postId: string,
  kind: PhotoKind,
  url: string
): Promise<{ attached: boolean; awardedXp: number }> {
  const post = await loadOwnedPost(userId, postId);
  const trimmed = url.trim();
  if (!trimmed) throw new Error("URL_REQUIRED");

  // 증거 첨부는 위치 인증 후에만 (= 현장에서 찍은 사진 보장). 미인증이면 거부.
  if (!post.locationVerified) throw new Error("NOT_VERIFIED");

  const data: Record<string, unknown> = { visitedAt: post.visitedAt ?? new Date() };
  if (kind === "photo") data.foodOrPlacePhotoUrl = trimmed;
  else if (kind === "receipt") data.receiptPhotoUrl = trimmed;
  else data.menuPhotoUrl = trimmed;

  // 인증 글: 뱃지 ON + XP 즉시 지급
  const regionId = post.restaurant.primaryRegionId;

  return prisma.$transaction(async (tx) => {
    if (kind === "photo") data.photoVerified = true;
    else if (kind === "receipt") data.receiptVerified = true;
    else data.menuVerified = true;
    await tx.restaurantPost.update({ where: { id: postId }, data });
    await awardXp(
      {
        userId,
        sourceType: PHOTO_SOURCE[kind],
        regionId,
        sourceId: postId,
        dedupeKey: `${PHOTO_SOURCE[kind]}:${postId}`,
      },
      tx
    );
    // 4종 풀인증 재확인
    const cur = await tx.restaurantPost.findUnique({
      where: { id: postId },
      select: { foodOrPlacePhotoUrl: true, receiptPhotoUrl: true, menuPhotoUrl: true },
    });
    if (cur?.foodOrPlacePhotoUrl && cur.receiptPhotoUrl && cur.menuPhotoUrl) {
      await awardXp(
        {
          userId,
          sourceType: "full_verify_bonus",
          regionId,
          sourceId: postId,
          dedupeKey: `full_verify_bonus:${postId}`,
        },
        tx
      );
    }
    const sum = await tx.xpEvent.aggregate({
      where: { userId, sourceId: postId },
      _sum: { xpAmount: true },
    });
    return { attached: true, awardedXp: sum._sum.xpAmount ?? 0 };
  });
}
