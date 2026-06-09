/**
 * AccountService — 계정 설정: 닉네임/아바타 변경, 알림 설정, 비활성화/탈퇴.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { nicknameSchema } from "@/lib/nickname";

export const NICKNAME_COOLDOWN_DAYS = 30;

export async function updateNickname(
  userId: string,
  raw: string
): Promise<{ ok: boolean; reason?: string; nextAllowedAt?: string }> {
  const parsed = nicknameSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: parsed.error.errors[0].message };
  const nickname = parsed.data;

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { nickname: true, nicknameUpdatedAt: true },
  });
  if (!me) return { ok: false, reason: "사용자를 찾을 수 없어요." };
  if (me.nickname === nickname) return { ok: true }; // 변경 없음

  // 30일 1회 제한
  if (me.nicknameUpdatedAt) {
    const next = new Date(me.nicknameUpdatedAt.getTime() + NICKNAME_COOLDOWN_DAYS * 86400000);
    if (next > new Date()) {
      return {
        ok: false,
        reason: `닉네임은 30일에 한 번만 바꿀 수 있어요. (${next.toLocaleDateString("ko-KR")} 이후 가능)`,
        nextAllowedAt: next.toISOString(),
      };
    }
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { nickname, nicknameUpdatedAt: new Date() },
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, reason: "이미 사용 중인 닉네임이에요." };
    }
    throw e;
  }
}

export async function updateAvatar(userId: string, avatarUrl: string | null): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { avatarUrl: avatarUrl || null } });
}

export async function updateNotifyPrefs(
  userId: string,
  prefs: { notifyLike: boolean; notifyComment: boolean }
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { notifyLike: prefs.notifyLike, notifyComment: prefs.notifyComment },
  });
}

/** 비활성화(쉬어가기) — 글/프로필 숨김. 다시 로그인하면 자동 복구. */
export async function deactivateAccount(userId: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { deactivatedAt: new Date() } });
}

/** 완전 탈퇴 — 내 글/댓글/저장/리스트/알림 등 전부 삭제(cascade). 내가 만든 가게는 유지(작성자만 null). */
export async function deleteAccount(userId: string): Promise<void> {
  await prisma.user.delete({ where: { id: userId } });
}
