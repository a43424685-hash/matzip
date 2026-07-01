"use server";

import { revalidatePath } from "next/cache";
import { getSessionAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/server/admin/AuditService";

export type MemberActionState = { ok?: boolean; error?: string } | undefined;

async function requireAdmin() {
  const admin = await getSessionAdmin();
  if (!admin?.isAdmin) return null;
  return admin;
}

/** 계정 정지 — 사유 필수. 운영자·본인은 정지 불가. 감사로그 기록. */
export async function suspendMemberAction(_prev: MemberActionState, formData: FormData): Promise<MemberActionState> {
  const admin = await requireAdmin();
  if (!admin) return { error: "권한이 없어요." };

  const userId = String(formData.get("userId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { error: "정지 사유를 입력해주세요." };

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } });
  if (!target) return { error: "회원을 찾을 수 없어요." };
  if (target.isAdmin) return { error: "운영자 계정은 정지할 수 없어요." };
  if (userId === admin.id) return { error: "본인 계정은 정지할 수 없어요." };

  await prisma.user.update({
    where: { id: userId },
    data: { suspendedAt: new Date(), suspendedReason: reason },
  });
  await writeAudit({ adminId: admin.id, action: "suspend", targetType: "user", targetId: userId, reason });
  revalidatePath(`/admin/members/${userId}`);
  return { ok: true };
}

/** 정지 해제 — 사유 선택. 감사로그 기록. */
export async function unsuspendMemberAction(_prev: MemberActionState, formData: FormData): Promise<MemberActionState> {
  const admin = await requireAdmin();
  if (!admin) return { error: "권한이 없어요." };

  const userId = String(formData.get("userId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!target) return { error: "회원을 찾을 수 없어요." };

  await prisma.user.update({
    where: { id: userId },
    data: { suspendedAt: null, suspendedReason: null },
  });
  await writeAudit({ adminId: admin.id, action: "unsuspend", targetType: "user", targetId: userId, reason });
  revalidatePath(`/admin/members/${userId}`);
  return { ok: true };
}

/** 관리자 메모 — 상태 변경 없이 감사로그에만 기록. 사유(메모) 필수. */
export async function memoMemberAction(_prev: MemberActionState, formData: FormData): Promise<MemberActionState> {
  const admin = await requireAdmin();
  if (!admin) return { error: "권한이 없어요." };

  const userId = String(formData.get("userId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { error: "메모 내용을 입력해주세요." };

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!target) return { error: "회원을 찾을 수 없어요." };

  await writeAudit({ adminId: admin.id, action: "memo", targetType: "user", targetId: userId, reason });
  revalidatePath(`/admin/members/${userId}`);
  return { ok: true };
}
