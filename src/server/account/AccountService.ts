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

/**
 * 완전 탈퇴 — 개인정보·콘텐츠는 즉시 파기하되, 계정 뼈대는 '탈퇴한 사용자'로 익명화해 남긴다.
 * 하드 delete를 쓰지 않는 이유:
 *  1) MapPurchase·Withdrawal이 cascade로 함께 사라져 전자상거래법상 거래기록 5년 보존 의무 위반
 *  2) 판매자 탈퇴 시 Collection cascade → 그 지도를 돈 주고 산 타인의 구매 기록·접근권까지 소멸
 */
export async function deleteAccount(userId: string): Promise<void> {
  const suffix = userId.slice(-8);
  await prisma.$transaction(
    async (tx) => {
      // 1) 내가 쓴 콘텐츠·활동 삭제 (기존 탈퇴와 같은 사용자 경험)
      await tx.restaurantPost.deleteMany({ where: { userId } });
      await tx.comment.deleteMany({ where: { userId } });
      await tx.communityPost.deleteMany({ where: { userId } });
      await tx.communityComment.deleteMany({ where: { userId } });
      await tx.like.deleteMany({ where: { userId } });
      await tx.save.deleteMany({ where: { userId } });
      await tx.commentLike.deleteMany({ where: { userId } });
      await tx.communityLike.deleteMany({ where: { userId } });
      await tx.proofAttempt.deleteMany({ where: { userId } });
      await tx.userRegionStat.deleteMany({ where: { userId } });
      await tx.follow.deleteMany({ where: { OR: [{ followerId: userId }, { followingId: userId }] } });
      await tx.block.deleteMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] } });
      await tx.notification.deleteMany({ where: { userId } });
      await tx.pushSubscription.deleteMany({ where: { userId } });
      await tx.authAccount.deleteMany({ where: { userId } }); // 소셜 재로그인 차단
      await tx.emailVerificationToken.deleteMany({ where: { userId } });

      // 2) 컬렉션: 구매 이력 없는 것은 삭제, 팔린 유료지도는 비공개로 보존(구매자 열람권 보호)
      const purchased = await tx.mapPurchase.findMany({
        where: { collection: { userId } },
        select: { collectionId: true },
        distinct: ["collectionId"],
      });
      const keepIds = purchased.map((p) => p.collectionId);
      await tx.collection.deleteMany({ where: { userId, id: { notIn: keepIds } } });
      await tx.collection.updateMany({ where: { userId, id: { in: keepIds } }, data: { isPublic: false } });

      // 3) 개인정보 파기 + 로그인 불가 처리 (MapPurchase·Withdrawal·XpEvent는 법정 보존)
      await tx.user.update({
        where: { id: userId },
        data: {
          email: `deleted-${suffix}@deleted.invalid`,
          nickname: `탈퇴한사용자${suffix}`,
          passwordHash: `deleted:${userId}`,
          avatarUrl: null,
          legalName: null,
          bankName: null,
          accountNumber: null,
          accountHolder: null,
          emailVerifiedAt: null,
          nicknameConfirmedAt: null,
          notifyLike: false,
          notifyComment: false,
          totalXp: 0,
          totalLevel: 1, // 랭킹에서 사라지게
          deletedAt: new Date(),
          deactivatedAt: new Date(),
        },
      });
    },
    { timeout: 30_000 },
  );
}
