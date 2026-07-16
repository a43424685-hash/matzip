/**
 * 신고(Report) — 글/댓글을 사용자가 신고하면 저장, 운영자가 검토/삭제.
 * 어뷰징 방지: 같은 사용자가 같은 대상을 1회만(스키마 unique), 자기 콘텐츠 신고 불가.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export const REPORT_REASONS = [
  "spam",
  "abuse",
  "sexual",
  "illegal",
  "wrong_info",
  "etc",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
const REASON_SET = new Set<string>(REPORT_REASONS);

export const REPORT_REASON_LABEL: Record<string, string> = {
  spam: "스팸/광고",
  abuse: "욕설/비방",
  sexual: "음란물",
  illegal: "불법정보",
  wrong_info: "허위/잘못된 정보",
  etc: "기타",
};

export type ReportTargetType = "post" | "comment";

export async function createReport(input: {
  reporterId: string;
  targetType: string;
  targetId: string;
  reason: string;
  detail?: string | null;
}): Promise<{ ok: boolean; reason?: string }> {
  const { reporterId, targetId } = input;
  const ALLOWED = ["post", "comment", "community_post", "community_comment"];
  if (!ALLOWED.includes(input.targetType)) {
    return { ok: false, reason: "BAD_TARGET" };
  }
  const targetType = input.targetType;
  const reason = REASON_SET.has(input.reason) ? input.reason : "etc";

  // 대상 존재 + 자기 콘텐츠 신고 방지
  if (targetType === "post") {
    const p = await prisma.restaurantPost.findUnique({ where: { id: targetId }, select: { userId: true } });
    if (!p) return { ok: false, reason: "NOT_FOUND" };
    if (p.userId === reporterId) return { ok: false, reason: "SELF" };
  } else if (targetType === "comment") {
    const c = await prisma.comment.findUnique({ where: { id: targetId }, select: { userId: true } });
    if (!c) return { ok: false, reason: "NOT_FOUND" };
    if (c.userId === reporterId) return { ok: false, reason: "SELF" };
  } else if (targetType === "community_post") {
    const p = await prisma.communityPost.findUnique({ where: { id: targetId }, select: { userId: true } });
    if (!p) return { ok: false, reason: "NOT_FOUND" };
    if (p.userId === reporterId) return { ok: false, reason: "SELF" };
  } else {
    const c = await prisma.communityComment.findUnique({ where: { id: targetId }, select: { userId: true } });
    if (!c) return { ok: false, reason: "NOT_FOUND" };
    if (c.userId === reporterId) return { ok: false, reason: "SELF" };
  }

  try {
    await prisma.report.create({
      data: {
        reporterId,
        targetType,
        targetId,
        reason,
        detail: input.detail?.trim().slice(0, 500) || null,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, reason: "DUPLICATE" }; // 이미 신고함
    }
    throw e;
  }

  // 정보통신망법 §44의2 임시조치 — 서로 다른 사용자 신고 N건 이상이면 자동 블라인드(운영자 검토 전).
  const BLIND_THRESHOLD = 3;
  if (targetType === "community_post" || targetType === "community_comment") {
    const count = await prisma.report.count({ where: { targetType, targetId, status: "open" } });
    if (count >= BLIND_THRESHOLD) {
      if (targetType === "community_post") {
        await prisma.communityPost
          .update({ where: { id: targetId }, data: { blindedAt: new Date(), blindedReason: "신고 누적 임시조치" } })
          .catch(() => {});
      } else {
        await prisma.communityComment
          .update({ where: { id: targetId }, data: { blindedAt: new Date() } })
          .catch(() => {});
      }
    }
  }
  return { ok: true };
}

export interface AdminReportRow {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  detail: string | null;
  status: string;
  createdAt: string;
  reporterNickname: string;
  postId: string | null; // 이동용 (글이면 자기 id, 댓글이면 소속 글 id)
  targetExists: boolean;
  targetLabel: string; // 가게명 · "댓글" · "커뮤니티 글" 등
  targetSnippet: string | null;
  targetAuthor: string | null;
  href: string | null; // 운영자 '보기' 링크
  deleteEndpoint: string | null; // 콘텐츠 삭제 API (타입별)
}

/** 운영자용 신고 목록 (대상 콘텐츠 미리보기 포함) */
export async function listReports(
  status: "open" | "resolved" | "all" = "open"
): Promise<AdminReportRow[]> {
  const reports = await prisma.report.findMany({
    where: status === "all" ? {} : { status },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { reporter: { select: { nickname: true } } },
  });

  const idsOf = (t: string) => reports.filter((r) => r.targetType === t).map((r) => r.targetId);
  const [posts, comments, cPosts, cComments] = await Promise.all([
    prisma.restaurantPost.findMany({
      where: { id: { in: idsOf("post") } },
      select: { id: true, shortReview: true, restaurant: { select: { name: true } }, user: { select: { nickname: true } } },
    }),
    prisma.comment.findMany({
      where: { id: { in: idsOf("comment") } },
      select: { id: true, content: true, postId: true, user: { select: { nickname: true } } },
    }),
    prisma.communityPost.findMany({
      where: { id: { in: idsOf("community_post") } },
      select: { id: true, title: true, content: true, user: { select: { nickname: true } } },
    }),
    prisma.communityComment.findMany({
      where: { id: { in: idsOf("community_comment") } },
      select: { id: true, content: true, communityPostId: true, user: { select: { nickname: true } } },
    }),
  ]);
  const postMap = new Map(posts.map((p) => [p.id, p]));
  const commentMap = new Map(comments.map((c) => [c.id, c]));
  const cPostMap = new Map(cPosts.map((p) => [p.id, p]));
  const cCommentMap = new Map(cComments.map((c) => [c.id, c]));

  return reports.map((r): AdminReportRow => {
    const base = {
      id: r.id,
      targetType: r.targetType,
      targetId: r.targetId,
      reason: r.reason,
      detail: r.detail,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      reporterNickname: r.reporter.nickname,
    };
    if (r.targetType === "post") {
      const p = postMap.get(r.targetId);
      return {
        ...base,
        postId: p?.id ?? null,
        targetExists: !!p,
        targetLabel: p?.restaurant.name ?? "(삭제됨)",
        targetSnippet: p?.shortReview ?? null,
        targetAuthor: p?.user.nickname ?? null,
        href: p ? `/restaurants/${p.id}` : null,
        deleteEndpoint: p ? `/api/posts/${p.id}` : null,
      };
    }
    if (r.targetType === "community_post") {
      const p = cPostMap.get(r.targetId);
      return {
        ...base,
        postId: null,
        targetExists: !!p,
        targetLabel: p ? `커뮤니티 글 · ${p.title}` : "커뮤니티 글",
        targetSnippet: p?.content?.slice(0, 200) ?? null,
        targetAuthor: p?.user.nickname ?? null,
        href: p ? `/community/${p.id}` : null,
        deleteEndpoint: p ? `/api/community/${p.id}` : null,
      };
    }
    if (r.targetType === "community_comment") {
      const c = cCommentMap.get(r.targetId);
      return {
        ...base,
        postId: null,
        targetExists: !!c,
        targetLabel: "커뮤니티 댓글",
        targetSnippet: c?.content ?? null,
        targetAuthor: c?.user.nickname ?? null,
        href: c ? `/community/${c.communityPostId}` : null,
        deleteEndpoint: c ? `/api/community/comments/${c.id}` : null,
      };
    }
    const c = commentMap.get(r.targetId);
    return {
      ...base,
      postId: c?.postId ?? null,
      targetExists: !!c,
      targetLabel: "댓글",
      targetSnippet: c?.content ?? null,
      targetAuthor: c?.user.nickname ?? null,
      href: c ? `/restaurants/${c.postId}` : null,
      deleteEndpoint: c ? `/api/comments/${c.id}` : null,
    };
  });
}

export async function resolveReport(reportId: string): Promise<void> {
  await prisma.report.update({ where: { id: reportId }, data: { status: "resolved" } });
}

export async function countOpenReports(): Promise<number> {
  return prisma.report.count({ where: { status: "open" } });
}
