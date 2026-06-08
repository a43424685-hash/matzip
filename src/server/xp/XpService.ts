/**
 * XpService — XP 지급 로직을 한 곳에 모은 서비스 (명세 18.1).
 *
 * 핵심 원칙:
 *  - 모든 XP 지급은 awardXp() 한 함수를 통한다.
 *  - 지급 시 반드시 XpEvent 로그를 남긴다 (멱등성/어뷰징/밸런스용).
 *  - dedupeKey 로 멱등성을 보장한다 (같은 좋아요/이벤트는 두 번 적립 안 됨).
 *  - 전체 XP(user.totalXp) 와 지역 XP(user_region_stats.regionXp) 를 함께 갱신한다.
 *  - 갱신 후 전체 레벨/지역 레벨을 재계산한다.
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { calculateLevel } from "./LevelService";
import { XP_AMOUNT, ABUSE_LIMITS, type XpSourceType } from "./xpRules";

// prisma 본체 또는 트랜잭션 클라이언트 모두 받을 수 있게
type Db = PrismaClient | Prisma.TransactionClient;

export interface AwardXpInput {
  userId: string;
  sourceType: XpSourceType;
  /** 미지정 시 XP_AMOUNT[sourceType] 사용 */
  amount?: number;
  /** 지역 XP 귀속 대상 (음식점 지역). null 이면 전체 XP만 적립 */
  regionId?: string | null;
  sourceId?: string | null;
  /** XP를 유발한 사용자 (좋아요/저장 누른 사람) */
  actorUserId?: string | null;
  /** 멱등성 키. 같은 키가 이미 있으면 skip */
  dedupeKey?: string | null;
}

export interface AwardXpResult {
  awarded: boolean;
  amount: number;
  reason?: "duplicate" | "zero";
}

/** 하루 경계(00:00) — 어뷰징 카운팅 기준 */
function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * 핵심: XP 지급.
 * @param db 트랜잭션 안에서 호출하려면 tx 클라이언트를 넘긴다.
 */
export async function awardXp(
  input: AwardXpInput,
  db: Db = prisma
): Promise<AwardXpResult> {
  const amount = input.amount ?? XP_AMOUNT[input.sourceType];
  if (!amount || amount <= 0) return { awarded: false, amount: 0, reason: "zero" };

  // 1) 멱등성: dedupeKey 가 있으면 기존 이벤트 확인
  if (input.dedupeKey) {
    const existing = await db.xpEvent.findUnique({
      where: { dedupeKey: input.dedupeKey },
      select: { id: true },
    });
    if (existing) return { awarded: false, amount: 0, reason: "duplicate" };
  }

  // 2) XP 이벤트 로그 (멱등 키 유니크 충돌은 race 로 간주하고 skip)
  try {
    await db.xpEvent.create({
      data: {
        userId: input.userId,
        actorUserId: input.actorUserId ?? null,
        regionId: input.regionId ?? null,
        sourceType: input.sourceType,
        sourceId: input.sourceId ?? null,
        xpAmount: amount,
        dedupeKey: input.dedupeKey ?? null,
      },
    });
  } catch (e: unknown) {
    if (input.dedupeKey && isUniqueViolation(e)) {
      return { awarded: false, amount: 0, reason: "duplicate" };
    }
    throw e;
  }

  // 3) 전체 XP 적립 + 전체 레벨 재계산
  const user = await db.user.update({
    where: { id: input.userId },
    data: { totalXp: { increment: amount } },
    select: { totalXp: true },
  });
  const totalLevel = calculateLevel(user.totalXp).level;
  await db.user.update({
    where: { id: input.userId },
    data: { totalLevel },
  });

  // 4) 지역 XP 적립 + 지역 레벨 재계산 (regionId 있을 때만)
  if (input.regionId) {
    const stat = await db.userRegionStat.upsert({
      where: { userId_regionId: { userId: input.userId, regionId: input.regionId } },
      create: {
        userId: input.userId,
        regionId: input.regionId,
        regionXp: amount,
      },
      update: { regionXp: { increment: amount } },
      select: { regionXp: true },
    });
    const regionLevel = calculateLevel(stat.regionXp).level;
    await db.userRegionStat.update({
      where: { userId_regionId: { userId: input.userId, regionId: input.regionId } },
      data: { regionLevel },
    });
  }

  return { awarded: true, amount };
}

// ─────────────────────────────────────────────────────────────
// 어뷰징 한도 헬퍼 (명세 6.4)
// ─────────────────────────────────────────────────────────────

/** 하루 맛집 등록 기본 XP(post_created) 적립 가능 여부 — 최대 10건 */
export async function dailyPostBaseAwardAllowed(
  userId: string,
  db: Db = prisma
): Promise<boolean> {
  const count = await db.xpEvent.count({
    where: {
      userId,
      sourceType: "post_created",
      createdAt: { gte: startOfToday() },
    },
  });
  return count < ABUSE_LIMITS.dailyPostBaseXpCap;
}

/**
 * 같은 사용자(actor)→대상(recipient) 좋아요 XP 적립 가능 여부.
 * 하루 최대 3개까지만 인정 (감쇠).
 */
export async function likeFromActorAllowed(
  actorUserId: string,
  recipientUserId: string,
  db: Db = prisma
): Promise<boolean> {
  if (actorUserId === recipientUserId) return false; // 셀프 좋아요 XP 없음
  const count = await db.xpEvent.count({
    where: {
      userId: recipientUserId,
      actorUserId,
      sourceType: "like_received",
      createdAt: { gte: startOfToday() },
    },
  });
  return count < ABUSE_LIMITS.likeFromSameActorDailyCap;
}

/**
 * 한 사용자(actor)가 오늘 발생시킨 공유 XP 이벤트 수가 상한 미만인지.
 * (인증글만 공유 XP가 나가고, 같은 글은 dedupeKey로 1회만 — 여기에 더해 하루 총량 제한)
 */
export async function shareFromActorAllowed(
  actorUserId: string,
  db: Db = prisma
): Promise<boolean> {
  const count = await db.xpEvent.count({
    where: {
      actorUserId,
      sourceType: "shared",
      createdAt: { gte: startOfToday() },
    },
  });
  return count < ABUSE_LIMITS.dailyShareXpCap;
}

function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: string }).code === "P2002"
  );
}
