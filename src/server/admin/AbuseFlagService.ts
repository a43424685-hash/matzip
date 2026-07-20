/**
 * 어뷰징 의심 플래그 — 시스템 자동 탐지(예: 짧은 시간 다수 위치 인증)를 운영자에게 보고.
 * 차단이 아니라 검토용. 운영자가 정지 처리하거나 오탐이면 무시(dismiss)한다.
 */
import { prisma } from "@/lib/db";

const KIND_LABEL: Record<string, string> = {
  rapid_location: "위치 인증 과다 (가짜 좌표 의심)",
};

export function abuseKindLabel(kind: string): string {
  return KIND_LABEL[kind] ?? kind;
}

/** 미검토(open) 의심 플래그 수 — 관리자 홈 배너용 */
export function countOpenAbuseFlags(): Promise<number> {
  return prisma.abuseFlag.count({ where: { status: "open" } });
}

export interface AbuseFlagRow {
  id: string;
  kind: string;
  detail: string | null;
  count: number;
  status: string;
  createdAt: string;
  userId: string;
  nickname: string;
  suspended: boolean;
}

export async function listAbuseFlags(status: "open" | "all" = "open"): Promise<AbuseFlagRow[]> {
  const rows = await prisma.abuseFlag.findMany({
    where: status === "all" ? {} : { status },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { select: { nickname: true, suspendedAt: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    detail: r.detail,
    count: r.count,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    userId: r.userId,
    nickname: r.user.nickname,
    suspended: !!r.user.suspendedAt,
  }));
}

/** 운영자: 플래그 처리 (검토완료/무시) */
export async function resolveAbuseFlag(id: string, action: "reviewed" | "dismissed"): Promise<{ ok: boolean }> {
  await prisma.abuseFlag.update({
    where: { id },
    data: { status: action, reviewedAt: new Date() },
  });
  return { ok: true };
}
