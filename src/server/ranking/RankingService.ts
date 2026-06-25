/**
 * RankingService — 랭킹 3종 (명세 5).
 *
 *  1) 전체 랭킹      : 전체 레벨 순 TOP 50 (동점 → 전체 XP → 최근 30일 활동 XP)
 *  2) 지역 랭킹      : 지역 레벨 순 TOP 50 (동점 → 지역 XP → 최근 30일 지역 XP)
 *  3) 이번 주 인기맛집 : 음식점 반응 점수 순 TOP 50 (전체/지역 필터)
 *
 * MVP는 실시간 쿼리. 데이터가 쌓이면 refreshRankingCache() 로 RankingCache 에
 * 적재 후 read 경로를 캐시로 전환할 수 있게 구조를 잡아둔다.
 */

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { REACTION_WEIGHT } from "../xp/xpRules";

export const TOP_N = 100;

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

/** 이번 주 시작 (월요일 00:00) */
function startOfWeek(): Date {
  const d = new Date();
  const day = d.getDay(); // 0(일)~6(토)
  const diff = (day + 6) % 7; // 월요일까지 거슬러 올라갈 일수
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ─────────────────────────────────────────────────────────────
// 공통 타입
// ─────────────────────────────────────────────────────────────
export interface UserRankRow {
  rank: number;
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  level: number;
  xp: number;
  recent30dXp: number;
}

export interface RestaurantRankRow {
  rank: number;
  restaurantId: string;
  name: string;
  regionName: string;
  score: number;
  weekLikes: number;
  weekSaves: number;
}

/** 후보 사용자들의 최근 30일 XP 합계 (전체 또는 특정 지역) */
async function recent30dXpByUser(
  userIds: string[],
  regionId?: string | null
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (userIds.length === 0) return map;
  const grouped = await prisma.xpEvent.groupBy({
    by: ["userId"],
    where: {
      userId: { in: userIds },
      createdAt: { gte: daysAgo(30) },
      ...(regionId ? { regionId } : {}),
    },
    _sum: { xpAmount: true },
  });
  for (const g of grouped) map.set(g.userId, g._sum.xpAmount ?? 0);
  return map;
}

// ─────────────────────────────────────────────────────────────
// 1) 전체 랭킹
// ─────────────────────────────────────────────────────────────
export async function getOverallUserRanking(limit = TOP_N): Promise<UserRankRow[]> {
  // 동점 tie-break(30일 활동)가 50위 경계를 넘나들 수 있어 버퍼를 두고 가져온다
  // 운영자(admin)는 랭킹에서 제외 (Lv.200 고정·의미 없음)
  const candidates = await prisma.user.findMany({
    where: { isAdmin: false, deactivatedAt: null },
    orderBy: [{ totalLevel: "desc" }, { totalXp: "desc" }, { createdAt: "asc" }],
    take: limit + 20,
    select: { id: true, nickname: true, avatarUrl: true, totalLevel: true, totalXp: true },
  });

  const recent = await recent30dXpByUser(candidates.map((c) => c.id));

  const sorted = candidates
    .map((c) => ({ ...c, recent30dXp: recent.get(c.id) ?? 0 }))
    .sort(
      (a, b) =>
        b.totalLevel - a.totalLevel ||
        b.totalXp - a.totalXp ||
        b.recent30dXp - a.recent30dXp
    )
    .slice(0, limit);

  return sorted.map((u, i) => ({
    rank: i + 1,
    userId: u.id,
    nickname: u.nickname,
    avatarUrl: u.avatarUrl,
    level: u.totalLevel,
    xp: u.totalXp,
    recent30dXp: u.recent30dXp,
  }));
}

/** 내 전체 순위 (TOP 50 밖이어도 계산). 동점은 레벨/XP 기준 근사. */
export async function getMyOverallRank(userId: string): Promise<number> {
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { totalLevel: true, totalXp: true, isAdmin: true },
  });
  if (!me || me.isAdmin) return 0; // 운영자는 랭킹 비대상
  const ahead = await prisma.user.count({
    where: {
      isAdmin: false,
      OR: [
        { totalLevel: { gt: me.totalLevel } },
        { totalLevel: me.totalLevel, totalXp: { gt: me.totalXp } },
      ],
    },
  });
  return ahead + 1;
}

/** 상위 랭커 userId 집합 (앱 전체 왕관 표시용). 기본 상위 30명. */
export async function getTopRankerIds(limit = 30): Promise<Set<string>> {
  const rows = await getOverallUserRankingCached();
  return new Set(rows.slice(0, limit).map((r) => r.userId));
}

/** 내가 활동한 모든 지역의 순위 (높은 순). 대표 지역 = 가장 높은 순위. */
export async function getMyRegionRanks(userId: string): Promise<{ regionName: string; rank: number }[]> {
  const stats = await prisma.userRegionStat.findMany({
    where: { userId },
    select: { regionId: true, region: { select: { name: true } } },
  });
  const ranks = await Promise.all(
    stats.map(async (s) => ({ regionName: s.region.name, rank: await getMyRegionRank(userId, s.regionId) }))
  );
  return ranks.filter((r) => r.rank > 0).sort((a, b) => a.rank - b.rank);
}

export interface RankNeighbor {
  rank: number;
  nickname: string;
  level: number;
}

/** 내 전체 순위 + 바로 위/아래 이웃 (100위 밖일 때 내 위치 가늠용). */
export async function getOverallRankNeighbors(
  userId: string
): Promise<{ myRank: number; above: RankNeighbor | null; below: RankNeighbor | null } | null> {
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { totalLevel: true, totalXp: true, isAdmin: true },
  });
  if (!me || me.isAdmin) return null;

  const ahead = await prisma.user.count({
    where: {
      isAdmin: false,
      deactivatedAt: null,
      OR: [
        { totalLevel: { gt: me.totalLevel } },
        { totalLevel: me.totalLevel, totalXp: { gt: me.totalXp } },
      ],
    },
  });
  const myRank = ahead + 1;

  const skip = Math.max(0, myRank - 2);
  const window = await prisma.user.findMany({
    where: { isAdmin: false, deactivatedAt: null },
    orderBy: [{ totalLevel: "desc" }, { totalXp: "desc" }, { createdAt: "asc" }],
    skip,
    take: 3,
    select: { id: true, nickname: true, totalLevel: true },
  });

  const meIdx = window.findIndex((u) => u.id === userId);
  const aboveU = meIdx > 0 ? window[meIdx - 1] : null;
  const belowU = meIdx >= 0 && meIdx < window.length - 1 ? window[meIdx + 1] : null;

  return {
    myRank,
    above: aboveU ? { rank: myRank - 1, nickname: aboveU.nickname, level: aboveU.totalLevel } : null,
    below: belowU ? { rank: myRank + 1, nickname: belowU.nickname, level: belowU.totalLevel } : null,
  };
}

/** 내 특정 지역 순위 (없으면 0). */
export async function getMyRegionRank(userId: string, regionId: string): Promise<number> {
  const me = await prisma.userRegionStat.findUnique({
    where: { userId_regionId: { userId, regionId } },
    select: { regionLevel: true, regionXp: true, user: { select: { isAdmin: true } } },
  });
  if (!me || me.user.isAdmin) return 0; // 운영자는 랭킹 비대상
  const ahead = await prisma.userRegionStat.count({
    where: {
      regionId,
      user: { isAdmin: false },
      OR: [
        { regionLevel: { gt: me.regionLevel } },
        { regionLevel: me.regionLevel, regionXp: { gt: me.regionXp } },
      ],
    },
  });
  return ahead + 1;
}

// ─────────────────────────────────────────────────────────────
// 2) 지역 랭킹
// ─────────────────────────────────────────────────────────────
export async function getRegionUserRanking(
  regionId: string,
  limit = TOP_N
): Promise<UserRankRow[]> {
  const candidates = await prisma.userRegionStat.findMany({
    where: { regionId, user: { isAdmin: false, deactivatedAt: null } },
    orderBy: [{ regionLevel: "desc" }, { regionXp: "desc" }, { createdAt: "asc" }],
    take: limit + 20,
    select: {
      userId: true,
      regionLevel: true,
      regionXp: true,
      user: { select: { nickname: true, avatarUrl: true } },
    },
  });

  const recent = await recent30dXpByUser(
    candidates.map((c) => c.userId),
    regionId
  );

  const sorted = candidates
    .map((c) => ({ ...c, recent30dXp: recent.get(c.userId) ?? 0 }))
    .sort(
      (a, b) =>
        b.regionLevel - a.regionLevel ||
        b.regionXp - a.regionXp ||
        b.recent30dXp - a.recent30dXp
    )
    .slice(0, limit);

  return sorted.map((s, i) => ({
    rank: i + 1,
    userId: s.userId,
    nickname: s.user.nickname,
    avatarUrl: s.user.avatarUrl,
    level: s.regionLevel,
    xp: s.regionXp,
    recent30dXp: s.recent30dXp,
  }));
}

// ─────────────────────────────────────────────────────────────
// 3) 이번 주 인기 맛집
// ─────────────────────────────────────────────────────────────
// 반응 점수 = 좋아요×1 + 저장×3 (+ 공유×5 / 방문인증×10 / 영상조회×0.1 는
// 이벤트 타임스탬프 테이블 도입 후 합산 — 데이터 구조만 열어둠)
export async function getWeeklyRestaurantRanking(
  regionId?: string | null,
  limit = TOP_N
): Promise<RestaurantRankRow[]> {
  const since = startOfWeek();

  // 이번 주 저장 (restaurant 단위)
  const weekSaves = await prisma.save.groupBy({
    by: ["restaurantId"],
    where: { createdAt: { gte: since } },
    _count: { _all: true },
  });

  // 이번 주 좋아요 (post → restaurant 매핑)
  const weekLikeRows = await prisma.like.findMany({
    where: { createdAt: { gte: since } },
    select: { post: { select: { restaurantId: true } } },
  });

  const saveMap = new Map<string, number>();
  for (const s of weekSaves) saveMap.set(s.restaurantId, s._count._all);

  const likeMap = new Map<string, number>();
  for (const l of weekLikeRows) {
    const rid = l.post.restaurantId;
    likeMap.set(rid, (likeMap.get(rid) ?? 0) + 1);
  }

  const restaurantIds = Array.from(new Set([...saveMap.keys(), ...likeMap.keys()]));
  if (restaurantIds.length === 0) return [];

  const restaurants = await prisma.restaurant.findMany({
    where: {
      id: { in: restaurantIds },
      ...(regionId ? { primaryRegionId: regionId } : {}),
    },
    select: { id: true, name: true, primaryRegion: { select: { name: true } } },
  });

  const scored = restaurants
    .map((r) => {
      const weekLikes = likeMap.get(r.id) ?? 0;
      const weekSavesN = saveMap.get(r.id) ?? 0;
      const score =
        weekLikes * REACTION_WEIGHT.like + weekSavesN * REACTION_WEIGHT.save;
      return {
        restaurantId: r.id,
        name: r.name,
        regionName: r.primaryRegion.name,
        score,
        weekLikes,
        weekSaves: weekSavesN,
      };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map((s, i) => ({ rank: i + 1, ...s }));
}

// ─────────────────────────────────────────────────────────────
// 캐시 적재 (향후 cron 으로 주기 실행) — 현재 read 경로는 실시간 쿼리 사용
// ─────────────────────────────────────────────────────────────
export async function refreshRankingCache(): Promise<void> {
  const overall = await getOverallUserRanking();
  const weekly = await getWeeklyRestaurantRanking();

  // 지역 랭킹: 활성 시도별로 region_users 캐시 적재 (regionId 로 구분)
  const regions = await prisma.region.findMany({
    where: { isActive: true, type: "province" },
    select: { id: true },
  });
  const regionRows: {
    rankingType: string;
    regionId: string;
    rank: number;
    targetId: string;
    score: number;
  }[] = [];
  for (const region of regions) {
    const rows = await getRegionUserRanking(region.id);
    for (const r of rows) {
      regionRows.push({
        rankingType: "region_users",
        regionId: region.id,
        rank: r.rank,
        targetId: r.userId,
        score: r.xp,
      });
    }
  }

  await prisma.$transaction([
    prisma.rankingCache.deleteMany({
      where: {
        rankingType: { in: ["overall_users", "region_users", "weekly_restaurants"] },
      },
    }),
    prisma.rankingCache.createMany({
      data: [
        ...overall.map((r) => ({
          rankingType: "overall_users",
          rank: r.rank,
          targetId: r.userId,
          score: r.xp,
        })),
        ...regionRows,
        ...weekly.map((r) => ({
          rankingType: "weekly_restaurants",
          rank: r.rank,
          targetId: r.restaurantId,
          score: r.score,
        })),
      ],
    }),
  ]);
}

// ─────────────────────────────────────────────────────────────
// 캐시된 읽기 경로 (Next.js Data Cache) — 매 요청 재계산 방지.
// 시간 기반으로 자동 재계산(revalidate), 배치(cron)에서 revalidateTag("rankings")로 즉시 갱신.
// 함수 인자(regionId 등)는 캐시 키에 자동 포함된다.
// ─────────────────────────────────────────────────────────────
const RANKING_REVALIDATE = 300; // 5분

export const getOverallUserRankingCached = unstable_cache(
  (limit: number = TOP_N) => getOverallUserRanking(limit),
  ["ranking:overall"],
  { revalidate: RANKING_REVALIDATE, tags: ["rankings"] }
);

export const getRegionUserRankingCached = unstable_cache(
  (regionId: string, limit: number = TOP_N) => getRegionUserRanking(regionId, limit),
  ["ranking:region"],
  { revalidate: RANKING_REVALIDATE, tags: ["rankings"] }
);

export const getWeeklyRestaurantRankingCached = unstable_cache(
  (regionId: string | null = null, limit: number = TOP_N) =>
    getWeeklyRestaurantRanking(regionId, limit),
  ["ranking:weekly"],
  { revalidate: RANKING_REVALIDATE, tags: ["rankings"] }
);
