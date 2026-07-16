/**
 * 커뮤니티 게시판 — 맛집 관련 소통. 카테고리 3종.
 * 신고/차단은 기존 인프라 재활용(Report targetType="community_post", Block).
 */
import { prisma } from "@/lib/db";
import { getBlockedIds } from "@/server/block/BlockService";
import { createNotification } from "@/server/notification/NotificationService";
import { awardXp } from "@/server/xp/XpService";
import { containsProfanity } from "@/lib/profanity";
import { COMMUNITY_CATEGORIES, isCommunityCategory, categoryLabel } from "@/lib/community";

// 서버 코드 호환용 재노출
export { COMMUNITY_CATEGORIES, isCommunityCategory, categoryLabel };
export type { CommunityCategory } from "@/lib/community";

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
  if (containsProfanity(title) || containsProfanity(content)) return { ok: false, reason: "PROFANITY" };

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
  take = 20,
  sort: "latest" | "hot" = "latest"
): Promise<CommunityCard[]> {
  const blocked = await getBlockedIds(viewerId);
  const rows = await prisma.communityPost.findMany({
    where: {
      blindedAt: null, // 신고 임시조치된 글 숨김
      ...(category && isCommunityCategory(category) ? { category } : {}),
      ...(blocked.length ? { userId: { notIn: blocked } } : {}),
    },
    orderBy:
      sort === "hot"
        ? [{ likeCount: "desc" }, { commentCount: "desc" }, { createdAt: "desc" }]
        : { createdAt: "desc" },
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
  const rows = await prisma.communityComment.findMany({
    where: { communityPostId: postId, blindedAt: null },
    orderBy: [{ isAccepted: "desc" }, { createdAt: "asc" }], // 채택 답변 상단
    select: {
      id: true,
      content: true,
      isAccepted: true,
      createdAt: true,
      userId: true,
      attachName: true,
      attachAddress: true,
      attachKakaoId: true,
      attachLat: true,
      attachLng: true,
      user: { select: { id: true, nickname: true, avatarUrl: true, isAdmin: true } },
    },
  });

  // 첨부 가게가 우리 앱에 등록돼 있으면 그 글로 링크 (카카오ID로 매칭)
  const kakaoIds = rows.map((r) => r.attachKakaoId).filter((x): x is string => !!x);
  const registeredPostByKakao = new Map<string, string>();
  if (kakaoIds.length) {
    const restos = await prisma.restaurant.findMany({
      where: { kakaoPlaceId: { in: kakaoIds } },
      select: {
        kakaoPlaceId: true,
        posts: { where: { visibility: "public" }, orderBy: { saveCount: "desc" }, take: 1, select: { id: true } },
      },
    });
    for (const r of restos) {
      if (r.kakaoPlaceId && r.posts[0]) registeredPostByKakao.set(r.kakaoPlaceId, r.posts[0].id);
    }
  }

  return rows.map((r) => ({
    id: r.id,
    content: r.content,
    isAccepted: r.isAccepted,
    createdAt: r.createdAt,
    userId: r.userId,
    user: r.user,
    attach: r.attachName
      ? {
          name: r.attachName,
          address: r.attachAddress,
          kakaoPlaceId: r.attachKakaoId,
          lat: r.attachLat,
          lng: r.attachLng,
          registeredPostId: r.attachKakaoId ? registeredPostByKakao.get(r.attachKakaoId) ?? null : null,
        }
      : null,
  }));
}

/** 운영자: 커뮤니티 글 블라인드 해제(오탐 복구) / 재블라인드. */
export async function setCommunityPostBlind(postId: string, blinded: boolean, reason?: string) {
  await prisma.communityPost.update({
    where: { id: postId },
    data: blinded ? { blindedAt: new Date(), blindedReason: reason || "운영자 조치" } : { blindedAt: null, blindedReason: null },
  });
  return { ok: true };
}

export interface AttachPlace {
  name: string;
  address?: string | null;
  kakaoPlaceId?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export async function addCommunityComment(
  userId: string,
  postId: string,
  content: string,
  place?: AttachPlace | null
) {
  const text = content?.trim();
  if (!text) return { ok: false, reason: "EMPTY" };
  if (containsProfanity(text)) return { ok: false, reason: "PROFANITY" };
  const post = await prisma.communityPost.findUnique({ where: { id: postId }, select: { userId: true } });
  if (!post) return { ok: false, reason: "NOT_FOUND" };
  await prisma.$transaction([
    prisma.communityComment.create({
      data: {
        communityPostId: postId,
        userId,
        content: text,
        attachName: place?.name?.trim() || null,
        attachAddress: place?.address?.trim() || null,
        attachKakaoId: place?.kakaoPlaceId || null,
        attachLat: place?.lat ?? null,
        attachLng: place?.lng ?? null,
      },
    }),
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

/** 커뮤니티 댓글 삭제 — 작성자 본인 또는 운영자. 채택된 답변이면 채택도 해제. */
export async function deleteCommunityComment(userId: string, commentId: string, isAdmin: boolean) {
  const c = await prisma.communityComment.findUnique({
    where: { id: commentId },
    select: { userId: true, communityPostId: true },
  });
  if (!c) return { ok: false, reason: "NOT_FOUND" };
  if (c.userId !== userId && !isAdmin) return { ok: false, reason: "FORBIDDEN" };
  await prisma.$transaction(async (tx) => {
    await tx.communityComment.delete({ where: { id: commentId } });
    await tx.communityPost.update({
      where: { id: c.communityPostId },
      data: { commentCount: { decrement: 1 } },
    });
    // 이 댓글이 채택 답변이었으면 채택 해제
    await tx.communityPost.updateMany({
      where: { id: c.communityPostId, acceptedCommentId: commentId },
      data: { acceptedCommentId: null },
    });
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

/** 등록된 맛집(공개 글) 이름 검색 — 답변에 카드로 첨부용. */
export async function searchRegisteredForAttach(q: string, limit = 8) {
  const query = q.trim();
  if (query.length < 1) return [];
  const rows = await prisma.restaurantPost.findMany({
    where: {
      visibility: "public",
      restaurant: { name: { contains: query, mode: "insensitive" } },
    },
    orderBy: { saveCount: "desc" },
    take: limit,
    select: {
      id: true,
      restaurant: { select: { name: true, primaryRegion: { select: { name: true } } } },
      media: { take: 1, orderBy: { sortOrder: "asc" }, select: { url: true, thumbnailUrl: true } },
    },
  });
  // 같은 가게 중복 제거(대표 1개)
  const seen = new Set<string>();
  const out: { postId: string; name: string; region: string; thumb: string | null }[] = [];
  for (const r of rows) {
    if (seen.has(r.restaurant.name)) continue;
    seen.add(r.restaurant.name);
    out.push({
      postId: r.id,
      name: r.restaurant.name,
      region: r.restaurant.primaryRegion.name,
      thumb: r.media[0]?.thumbnailUrl ?? r.media[0]?.url ?? null,
    });
  }
  return out;
}

/** Q&A 답변 채택 — 질문 작성자만. XP는 방어책과 함께(자기채택 제외·카드첨부 게이트·1일 상한·멱등). */
export async function acceptCommunityAnswer(questionAuthorId: string, postId: string, commentId: string) {
  const post = await prisma.communityPost.findUnique({
    where: { id: postId },
    select: { userId: true, acceptedCommentId: true },
  });
  if (!post) return { ok: false, reason: "NOT_FOUND" };
  if (post.userId !== questionAuthorId) return { ok: false, reason: "FORBIDDEN" };
  const comment = await prisma.communityComment.findUnique({
    where: { id: commentId },
    select: { userId: true, communityPostId: true, attachKakaoId: true, attachName: true },
  });
  if (!comment || comment.communityPostId !== postId) return { ok: false, reason: "NOT_FOUND" };
  const hasAttach = !!(comment.attachKakaoId || comment.attachName);

  const ops = [];
  if (post.acceptedCommentId && post.acceptedCommentId !== commentId) {
    ops.push(prisma.communityComment.update({ where: { id: post.acceptedCommentId }, data: { isAccepted: false } }));
  }
  ops.push(prisma.communityComment.update({ where: { id: commentId }, data: { isAccepted: true } }));
  ops.push(prisma.communityPost.update({ where: { id: postId }, data: { acceptedCommentId: commentId } }));
  await prisma.$transaction(ops);

  // XP: 자기채택 제외 + 맛집카드 첨부 답변만 + 1일 3건 상한 + dedupeKey 멱등
  if (comment.userId !== questionAuthorId && hasAttach) {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const todayCount = await prisma.xpEvent.count({
      where: { userId: comment.userId, sourceType: "community_answer_accepted", createdAt: { gte: dayStart } },
    });
    if (todayCount < 3) {
      await awardXp({
        userId: comment.userId,
        sourceType: "community_answer_accepted",
        actorUserId: questionAuthorId,
        dedupeKey: `community_accept:${commentId}`,
      });
    }
  }
  // 채택 알림
  await createNotification(prisma, {
    userId: comment.userId,
    actorUserId: questionAuthorId,
    type: "community_accepted",
    communityPostId: postId,
  });
  return { ok: true };
}
