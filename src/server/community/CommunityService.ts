/**
 * 커뮤니티 게시판 — 맛집 관련 소통. 카테고리 3종.
 * 신고/차단은 기존 인프라 재활용(Report targetType="community_post", Block).
 */
import { prisma } from "@/lib/db";
import { getBlockedIds } from "@/server/block/BlockService";
import { createNotification } from "@/server/notification/NotificationService";

export const COMMUNITY_CATEGORIES = [
  { key: "recommend", label: "맛집 추천받기" },
  { key: "review", label: "후기·자랑" },
  { key: "free", label: "자유수다" },
] as const;

export type CommunityCategory = "recommend" | "review" | "free";

export function isCommunityCategory(v: string): v is CommunityCategory {
  return v === "recommend" || v === "review" || v === "free";
}
export function categoryLabel(key: string): string {
  return COMMUNITY_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

export interface CommunityCard {
  id: string;
  category: string;
  title: string;
  excerpt: string;
  thumb: string | null;
  hasVideo: boolean;
  likeCount: number;
  commentCount: number;
  createdAt: Date;
  author: { id: string; nickname: string; avatarUrl: string | null; isAdmin: boolean };
}

export async function createCommunityPost(
  userId: string,
  input: { category: string; title: string; content: string; imageUrls?: string[]; videoUrl?: string | null; videoThumbUrl?: string | null }
): Promise<{ ok: boolean; id?: string; reason?: string }> {
  const category = input.category;
  const title = input.title?.trim();
  const content = input.content?.trim();
  if (!isCommunityCategory(category)) return { ok: false, reason: "BAD_CATEGORY" };
  if (!title || title.length > 100) return { ok: false, reason: "BAD_TITLE" };
  if (!content) return { ok: false, reason: "BAD_CONTENT" };

  const post = await prisma.communityPost.create({
    data: {
      userId,
      category,
      title,
      content,
      imageUrls: (input.imageUrls ?? []).slice(0, 10),
      videoUrl: input.videoUrl || null,
      videoThumbUrl: input.videoThumbUrl || null,
    },
    select: { id: true },
  });
  return { ok: true, id: post.id };
}

export async function listCommunityPosts(
  viewerId: string | null,
  category: string | null,
  skip = 0,
  take = 20
): Promise<CommunityCard[]> {
  const blocked = await getBlockedIds(viewerId);
  const rows = await prisma.communityPost.findMany({
    where: {
      blindedAt: null, // 신고 임시조치된 글 숨김
      ...(category && isCommunityCategory(category) ? { category } : {}),
      ...(blocked.length ? { userId: { notIn: blocked } } : {}),
    },
    orderBy: { createdAt: "desc" },
    skip,
    take,
    select: {
      id: true,
      category: true,
      title: true,
      content: true,
      imageUrls: true,
      videoThumbUrl: true,
      videoUrl: true,
      likeCount: true,
      commentCount: true,
      createdAt: true,
      user: { select: { id: true, nickname: true, avatarUrl: true, isAdmin: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    category: r.category,
    title: r.title,
    excerpt: r.content.slice(0, 120),
    thumb: r.imageUrls[0] ?? null,
    hasVideo: false,
    likeCount: r.likeCount,
    commentCount: r.commentCount,
    createdAt: r.createdAt,
    author: r.user,
  }));
}

export async function getCommunityPost(id: string, viewerId: string | null) {
  const post = await prisma.communityPost.findUnique({
    where: { id },
    select: {
      id: true,
      category: true,
      title: true,
      content: true,
      imageUrls: true,
      videoUrl: true,
      videoThumbUrl: true,
      likeCount: true,
      commentCount: true,
      blindedAt: true,
      acceptedCommentId: true,
      createdAt: true,
      userId: true,
      user: { select: { id: true, nickname: true, avatarUrl: true, isAdmin: true, totalLevel: true } },
    },
  });
  if (!post) return null;
  // 차단한 작성자의 글은 숨김
  let viewerIsAdmin = false;
  if (viewerId) {
    const [blocked, me] = await Promise.all([
      getBlockedIds(viewerId),
      prisma.user.findUnique({ where: { id: viewerId }, select: { isAdmin: true } }),
    ]);
    if (blocked.includes(post.userId)) return null;
    viewerIsAdmin = !!me?.isAdmin;
  }
  // 신고 임시조치(블라인드): 작성자·관리자만 접근(안내 표시), 나머지는 숨김
  if (post.blindedAt && post.userId !== viewerId && !viewerIsAdmin) return null;
  const liked = viewerId
    ? !!(await prisma.communityLike.findUnique({
        where: { communityPostId_userId: { communityPostId: id, userId: viewerId } },
        select: { id: true },
      }))
    : false;
  return { post, liked };
}

export async function toggleCommunityLike(userId: string, postId: string): Promise<{ liked: boolean; likeCount: number }> {
  const existing = await prisma.communityLike.findUnique({
    where: { communityPostId_userId: { communityPostId: postId, userId } },
    select: { id: true },
  });
  if (existing) {
    await prisma.$transaction([
      prisma.communityLike.delete({ where: { id: existing.id } }),
      prisma.communityPost.update({ where: { id: postId }, data: { likeCount: { decrement: 1 } } }),
    ]);
  } else {
    await prisma.$transaction([
      prisma.communityLike.create({ data: { communityPostId: postId, userId } }),
      prisma.communityPost.update({ where: { id: postId }, data: { likeCount: { increment: 1 } } }),
    ]);
  }
  const post = await prisma.communityPost.findUnique({ where: { id: postId }, select: { likeCount: true } });
  return { liked: !existing, likeCount: post?.likeCount ?? 0 };
}

export async function listCommunityComments(postId: string) {
  return prisma.communityComment.findMany({
    where: { communityPostId: postId, blindedAt: null },
    orderBy: [{ isAccepted: "desc" }, { createdAt: "asc" }], // 채택 답변 상단
    select: {
      id: true,
      content: true,
      isAccepted: true,
      createdAt: true,
      userId: true,
      user: { select: { id: true, nickname: true, avatarUrl: true, isAdmin: true } },
      restaurant: {
        select: {
          id: true,
          restaurant: { select: { name: true, primaryRegion: { select: { name: true } } } },
          media: { take: 1, orderBy: { sortOrder: "asc" }, select: { url: true, thumbnailUrl: true } },
        },
      },
    },
  });
}

/** 운영자: 커뮤니티 글 블라인드 해제(오탐 복구) / 재블라인드. */
export async function setCommunityPostBlind(postId: string, blinded: boolean, reason?: string) {
  await prisma.communityPost.update({
    where: { id: postId },
    data: blinded ? { blindedAt: new Date(), blindedReason: reason || "운영자 조치" } : { blindedAt: null, blindedReason: null },
  });
  return { ok: true };
}

export async function addCommunityComment(userId: string, postId: string, content: string) {
  const text = content?.trim();
  if (!text) return { ok: false, reason: "EMPTY" };
  const post = await prisma.communityPost.findUnique({ where: { id: postId }, select: { userId: true } });
  if (!post) return { ok: false, reason: "NOT_FOUND" };
  await prisma.$transaction([
    prisma.communityComment.create({ data: { communityPostId: postId, userId, content: text } }),
    prisma.communityPost.update({ where: { id: postId }, data: { commentCount: { increment: 1 } } }),
  ]);
  // 글 작성자에게 알림 (본인 댓글 제외)
  await createNotification(prisma, {
    userId: post.userId,
    actorUserId: userId,
    type: "community_comment",
    communityPostId: postId,
  });
  return { ok: true };
}

export async function deleteCommunityPost(userId: string, postId: string, isAdmin: boolean) {
  const post = await prisma.communityPost.findUnique({ where: { id: postId }, select: { userId: true } });
  if (!post) return { ok: false, reason: "NOT_FOUND" };
  if (post.userId !== userId && !isAdmin) return { ok: false, reason: "FORBIDDEN" };
  await prisma.communityPost.delete({ where: { id: postId } });
  return { ok: true };
}
