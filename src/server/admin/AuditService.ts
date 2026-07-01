/**
 * AuditService — 운영자 조치 감사 로그. append-only (수정/삭제 안 함).
 * 누가(adminId)·언제·무엇을(action)·누구에게(target)·왜(reason) 남긴다.
 */
import { prisma } from "@/lib/db";

export type AuditAction = "suspend" | "unsuspend" | "memo" | "view_account";

export async function writeAudit(input: {
  adminId: string;
  action: AuditAction;
  targetType: string;
  targetId: string;
  reason?: string | null;
  result?: "ok" | "denied" | "error";
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      adminId: input.adminId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason?.trim() || null,
      result: input.result ?? "ok",
    },
  });
}

export interface AuditRow {
  id: string;
  action: string;
  reason: string | null;
  createdAt: Date;
  adminNickname: string;
}

/** 특정 대상(회원 등)에 대한 조치 이력 — 최신순. */
export async function listAuditForTarget(
  targetType: string,
  targetId: string,
  limit = 20
): Promise<AuditRow[]> {
  const rows = await prisma.auditLog.findMany({
    where: { targetType, targetId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      action: true,
      reason: true,
      createdAt: true,
      admin: { select: { nickname: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    reason: r.reason,
    createdAt: r.createdAt,
    adminNickname: r.admin.nickname,
  }));
}
