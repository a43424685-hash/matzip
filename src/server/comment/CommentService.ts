/**
 * CommentService — 맛집 글 댓글 (경험치 없음).
 *  - 댓글/답글(1단계 대댓글만 — 답글의 답글은 같은 부모로 평탄화), 댓글 좋아요, 글쓴이 상단 고정, 본인 댓글 삭제
 *  - 도배 방지: 하루 상한, 같은 글 직전과 동일 내용 연속 금지, 길이 제한
 *  - 욕설/성적 표현 필터
 */
import { prisma } from "@/lib/db";
import { ABUSE_LIMITS } from "../xp/xpRules";
import { getBlockedIds } from "../block/BlockService";
import { createNotification } from "../notification/NotificationService";
import { containsProfanity } from "@/lib/profanity";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export interface CommentUser {
  id: string;
  nickname: string;
  level: number;
  avatarUrl: string | null;
  isOfficial: boolean;
}
export interface CommentNode {
  id: string;
  content: string;
  createdAt: string; // ISO (클라이언트 전달/직렬화 일관)
  likeCount: number;
  likedByMe: boolean;
  isPinned: boolean;
  isMine: boolean;
  user: CommentUser;
  replies: CommentNode[];
}

/** 댓글/답글 작성 (경험치 없음) */
export async function addComment(
  userId: string,
  postId: string,
  contentRaw: string,
  parentId?: string | null
): Promise<{ id: string }> {
  const content = contentRaw.trim();
  if (!content) throw new Error("EMPTY");
  if (content.length > ABUSE_LIMITS.maxCommentLength) throw new Error("TOO_LONG");
  if (containsProfanity(content)) throw new Error("PROFANITY");

  const post = await prisma.restaurantPost.findUnique({
    where: { id: postId },
    select: { id: true, userId: true },
  });
  if (!post) throw new Error("POST_NOT_FOUND");

  // 답글은 1단계만 허용 — 답글의 답글이면 그 부모(최상위)에 매달아 평탄화한다.
  let parentAuthorId: string | null = null;
  let effectiveParentId: string | null = parentId ?? null;
  if (parentId) {
    const parent = await prisma.comment.findUnique({
      where: { id: parentId },
      select: { postId: true, userId: true, parentId: true },
    });
    if (!parent || parent.postId !== postId) throw new Error("BAD_PARENT");
    parentAuthorId = parent.userId;
    effectiveParentId = parent.parentId ?? parentId; // 답글의 답글 → 최상위 부모로
  }

  // 도배 방지: 하루 상한
  const todayCount = await prisma.comment.count({
    where: { userId, createdAt: { gte: startOfToday() } },
  });
  if (todayCount >= ABUSE_LIMITS.dailyCommentCap) throw new Error("DAILY_CAP");

  // 도배 방지: 같은 글에 직전과 동일 내용 연속 금지
  const last = await prisma.comment.findFirst({
    where: { userId, postId },
    orderBy: { createdAt: "desc" },
    select: { content: true },
  });
  if (last && last.content === content) throw new Error("DUPLICATE");

  return prisma.$transaction(async (tx) => {
    const c = await tx.comment.create({
      data: { postId, userId, parentId: effectiveParentId, content },
      select: { id: true },
    });
    await tx.restaurantPost.update({
      where: { id: postId },
      data: { commentCount: { increment: 1 } },
    });

    // 알림: 글 작성자에게 (셀프 제외는 서비스 내부 처리)
    await createNotification(tx, {
      userId: post.userId,
      actorUserId: userId,
      type: "comment",
      postId,
      commentId: c.id,
    });
    // 답글이면 부모 댓글 작성자에게도 (글 작성자와 다를 때만 — 중복 방지)
    if (parentAuthorId && parentAuthorId !== post.userId) {
      await createNotification(tx, {
        userId: parentAuthorId,
        actorUserId: userId,
        type: "reply",
        postId,
        commentId: c.id,
      });
    }
    return { id: c.id };
  });
}

/** 댓글 좋아요 토글 */
export async function toggleCommentLike(
  userId: string,
  commentId: string
): Promise<{ liked: boolean; likeCount: number }> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.commentLike.findUnique({
      where: { commentId_userId: { commentId, userId } },
      select: { id: true },
    });
    if (existing) {
      await tx.commentLike.delete({ where: { id: existing.id } });
      const c = await tx.comment.update({
        where: { id: commentId },
        data: { likeCount: { decrement: 1 } },
        select: { likeCount: true },
      });
      return { liked: false, likeCount: c.likeCount };
    }
    await tx.commentLike.create({ data: { commentId, userId } });
    const c = await tx.comment.update({
      where: { id: commentId },
      data: { likeCount: { increment: 1 } },
      select: { likeCount: true },
    });
    return { liked: true, likeCount: c.likeCount };
  });
}

/** 상단 고정 토글 — 글쓴이만, 최상위 댓글만 */
export async function togglePinComment(
  userId: string,
  commentId: string
): Promise<{ pinned: boolean }> {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { parentId: true, isPinned: true, post: { select: { userId: true } } },
  });
  if (!comment) throw new Error("NOT_FOUND");
  if (comment.post.userId !== userId) throw new Error("FORBIDDEN"); // 글쓴이만
  if (comment.parentId) throw new Error("REPLY_PIN"); // 답글은 고정 불가
  const updated = await prisma.comment.update({
    where: { id: commentId },
    data: { isPinned: !comment.isPinned },
    select: { isPinned: true },
  });
  return { pinned: updated.isPinned };
}

/** 본인 댓글 삭제 (답글까지 함께 삭제) */
export async function deleteComment(
  userId: string,
  commentId: string,
  isAdmin = false
): Promise<{ deleted: number }> {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { userId: true, postId: true },
  });
  if (!comment) throw new Error("NOT_FOUND");
  if (comment.userId !== userId && !isAdmin) throw new Error("FORBIDDEN"); // 본인 댓글 또는 운영자
  return prisma.$transaction(async (tx) => {
    const before = await tx.comment.count({ where: { postId: comment.postId } });
    await tx.comment.delete({ where: { id: commentId } }); // 딸린 답글(무한 깊이) cascade
    const after = await tx.comment.count({ where: { postId: comment.postId } });
    await tx.restaurantPost.update({
      where: { id: comment.postId },
      data: { commentCount: after }, // 실제 개수로 동기화 (깊이 무관 정확)
    });
    // 이 댓글에 대한 미처리 신고는 처리됨으로
    await tx.report.updateMany({
      where: { targetType: "comment", targetId: commentId, status: "open" },
      data: { status: "resolved" },
    });
    return { deleted: before - after };
  });
}

/** 글의 댓글 목록 (고정 먼저 → 최신, 답글 포함) */
export async function getComments(
  postId: string,
  currentUserId: string | null
): Promise<CommentNode[]> {
  const rows = await prisma.comment.findMany({
    where: { postId },
    orderBy: [{ createdAt: "asc" }],
    select: {
      id: true,
      content: true,
      createdAt: true,
      likeCount: true,
      isPinned: true,
      parentId: true,
      userId: true,
      user: { select: { id: true, nickname: true, totalLevel: true, avatarUrl: true, isAdmin: true } },
      likes: currentUserId
        ? { where: { userId: currentUserId }, select: { id: true } }
        : false,
    },
  });

  const toNode = (r: (typeof rows)[number]): CommentNode => ({
    id: r.id,
    content: r.content,
    createdAt: r.createdAt.toISOString(),
    likeCount: r.likeCount,
    likedByMe: Array.isArray(r.likes) ? r.likes.length > 0 : false,
    isPinned: r.isPinned,
    isMine: !!currentUserId && r.userId === currentUserId,
    user: { id: r.user.id, nickname: r.user.nickname, level: r.user.totalLevel, avatarUrl: r.user.avatarUrl, isOfficial: r.user.isAdmin },
    replies: [],
  });

  // 1단계 평탄화: 모든 답글을 '최상위 부모(root)'의 replies 에 매단다.
  // (정책은 1단계만 허용하지만, 정책 이전의 깊은 답글도 화면에선 1단계로 보이게 함)
  // rows 는 createdAt asc 라 답글은 자연히 시간순(오래된→최신)으로 쌓인다.
  const parentOf = new Map<string, string | null>(rows.map((r) => [r.id, r.parentId]));
  const rootOf = (id: string): string => {
    let cur = id;
    const seen = new Set<string>();
    let p = parentOf.get(cur) ?? null;
    while (p && !seen.has(p)) {
      seen.add(p);
      cur = p;
      p = parentOf.get(cur) ?? null;
    }
    return cur;
  };
  const nodeById = new Map<string, CommentNode>();
  for (const r of rows) nodeById.set(r.id, toNode(r));
  const roots: CommentNode[] = [];
  for (const r of rows) {
    const node = nodeById.get(r.id)!;
    if (!r.parentId) {
      roots.push(node);
      continue;
    }
    const root = nodeById.get(rootOf(r.id));
    if (root && root.id !== node.id) root.replies.push(node);
    else roots.push(node);
  }
  // 최상위만 고정 먼저, 그다음 최신순
  roots.sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // 차단한 사용자의 댓글은 하위 답글까지 통째로 숨김
  if (currentUserId) {
    const blocked = new Set(await getBlockedIds(currentUserId));
    if (blocked.size > 0) {
      const prune = (nodes: CommentNode[]): CommentNode[] =>
        nodes
          .filter((n) => !blocked.has(n.user.id))
          .map((n) => ({ ...n, replies: prune(n.replies) }));
      return prune(roots);
    }
  }
  return roots;
}
