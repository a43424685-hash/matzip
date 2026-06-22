/**
 * 알림(인앱) — 좋아요/댓글/답글 수신자에게 1건. 자기 자신 행동은 알림 없음.
 * 생성은 like/comment 서비스에서 호출(트랜잭션 클라이언트 전달 가능).
 */
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { getBlockedIds } from "../block/BlockService";
import { sendWebPush } from "../push/PushService";

const PUSH_MSG: Record<NotificationType, string> = {
  like: "회원님의 글을 좋아해요",
  comment: "회원님의 글에 새 댓글이 달렸어요",
  reply: "회원님의 댓글에 새 답글이 달렸어요",
};

type Db = Prisma.TransactionClient | typeof prisma;

export type NotificationType = "like" | "comment" | "reply";

export async function createNotification(
  db: Db,
  input: {
    userId: string; // 수신자
    actorUserId: string; // 행동한 사람
    type: NotificationType;
    postId?: string | null;
    commentId?: string | null;
  }
): Promise<void> {
  if (input.userId === input.actorUserId) return; // 자기 행동은 알림 없음

  // 수신자 알림 설정 반영 — 끈 종류는 생성하지 않음
  const pref = await db.user.findUnique({
    where: { id: input.userId },
    select: { notifyLike: true, notifyComment: true },
  });
  if (!pref) return;
  if (input.type === "like" && !pref.notifyLike) return;
  if ((input.type === "comment" || input.type === "reply") && !pref.notifyComment) return;

  // 좋아요 알림 멱등: 같은 사람이 같은 글을 재좋아요(취소→다시) 해도 알림은 1개만.
  // (댓글/답글은 각각 별개 이벤트라 매번 생성)
  if (input.type === "like") {
    const dup = await db.notification.findFirst({
      where: {
        userId: input.userId,
        actorUserId: input.actorUserId,
        type: "like",
        postId: input.postId ?? null,
      },
      select: { id: true },
    });
    if (dup) return;
  }

  await db.notification.create({
    data: {
      userId: input.userId,
      actorUserId: input.actorUserId,
      type: input.type,
      postId: input.postId ?? null,
      commentId: input.commentId ?? null,
    },
  });

  // 웹 푸시도 함께(켜둔 사람만 발송됨, 비밀키 없으면 자동 패스)
  void sendWebPush(input.userId, {
    title: "먹고핀",
    body: PUSH_MSG[input.type],
    url: input.postId ? `/restaurants/${input.postId}` : "/notifications",
  }).catch(() => {});
}

export async function unreadCount(userId: string): Promise<number> {
  const blocked = await getBlockedIds(userId);
  return prisma.notification.count({
    where: {
      userId,
      read: false,
      ...(blocked.length > 0 ? { actorUserId: { notIn: blocked } } : {}),
    },
  });
}

export async function markAllRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
}

export interface NotificationRow {
  id: string;
  type: string;
  read: boolean;
  createdAt: string;
  actorNickname: string | null;
  actorIsOfficial: boolean;
  postId: string | null;
  restaurantName: string | null;
  collectionId: string | null;
  collectionTitle: string | null;
}

export async function listNotifications(userId: string, limit = 50): Promise<NotificationRow[]> {
  const blocked = new Set(await getBlockedIds(userId));
  const all = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      read: true,
      createdAt: true,
      postId: true,
      collectionId: true,
      actorUserId: true,
      actor: { select: { nickname: true, isAdmin: true } },
    },
  });
  // 차단한 사용자의 활동 알림은 숨김
  const rows = all.filter((r) => !r.actorUserId || !blocked.has(r.actorUserId));

  const postIds = rows.map((r) => r.postId).filter((id): id is string => !!id);
  const posts =
    postIds.length > 0
      ? await prisma.restaurantPost.findMany({
          where: { id: { in: postIds } },
          select: { id: true, restaurant: { select: { name: true } } },
        })
      : [];
  const nameById = new Map(posts.map((p) => [p.id, p.restaurant.name]));

  const colIds = rows.map((r) => r.collectionId).filter((id): id is string => !!id);
  const cols =
    colIds.length > 0
      ? await prisma.collection.findMany({ where: { id: { in: colIds } }, select: { id: true, title: true } })
      : [];
  const titleById = new Map(cols.map((c) => [c.id, c.title]));

  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    read: r.read,
    createdAt: r.createdAt.toISOString(),
    actorNickname: r.actor?.nickname ?? null,
    actorIsOfficial: r.actor?.isAdmin ?? false,
    postId: r.postId,
    restaurantName: r.postId ? nameById.get(r.postId) ?? null : null,
    collectionId: r.collectionId,
    collectionTitle: r.collectionId ? titleById.get(r.collectionId) ?? null : null,
  }));
}
