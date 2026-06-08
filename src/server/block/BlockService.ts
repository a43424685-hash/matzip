/**
 * 사용자 차단 — blocker 가 blocked 의 글/댓글을 안 보게 (단방향).
 * 피드/검색/댓글 조회에서 blocked 의 콘텐츠를 제외하는 데 getBlockedIds 를 쓴다.
 */
import { prisma } from "@/lib/db";

export async function blockUser(
  blockerId: string,
  blockedId: string
): Promise<{ ok: boolean; reason?: string }> {
  if (blockerId === blockedId) return { ok: false, reason: "SELF" };
  const target = await prisma.user.findUnique({ where: { id: blockedId }, select: { id: true } });
  if (!target) return { ok: false, reason: "NOT_FOUND" };
  await prisma.block.upsert({
    where: { blockerId_blockedId: { blockerId, blockedId } },
    create: { blockerId, blockedId },
    update: {},
  });
  return { ok: true };
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<{ ok: boolean }> {
  await prisma.block.deleteMany({ where: { blockerId, blockedId } });
  return { ok: true };
}

/** 이 사용자가 차단한 사용자 id 집합 (피드/댓글 필터용). 비로그인은 빈 집합. */
export async function getBlockedIds(userId: string | null): Promise<string[]> {
  if (!userId) return [];
  const rows = await prisma.block.findMany({
    where: { blockerId: userId },
    select: { blockedId: true },
  });
  return rows.map((r) => r.blockedId);
}

export interface BlockedUserRow {
  id: string;
  nickname: string;
  level: number;
  blockedAt: string;
}

export async function listBlocked(userId: string): Promise<BlockedUserRow[]> {
  const rows = await prisma.block.findMany({
    where: { blockerId: userId },
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
      blocked: { select: { id: true, nickname: true, totalLevel: true } },
    },
  });
  return rows.map((r) => ({
    id: r.blocked.id,
    nickname: r.blocked.nickname,
    level: r.blocked.totalLevel,
    blockedAt: r.createdAt.toISOString(),
  }));
}
