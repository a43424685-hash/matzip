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
  if (input.targetType !== "post" && input.targetType !== "comment") {
    return { ok: false, reason: "BAD_TARGET" };
  }
  const targetType = input.targetType;
  const reason = REASON_SET.has(input.reason) ? input.reason : "etc";

  // 대상 존재 + 자기 콘텐츠 신고 방지
  if (targetType === "post") {
    const p = await prisma.restaurantPost.findUnique({
      where: { id: targetId },
      select: { userId: true },
    });
    if (!p) return { ok: false, reason: "NOT_FOUND" };
    if (p.userId === reporterId) return { ok: false, reason: "SELF" };
  } else {
    const c = await prisma.comment.findUnique({
      where: { id: targetId },
      select: { userId: true },
    });
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
    return { ok: true };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, reason: "DUPLICATE" }; // 이미 신고함
    }
    throw e;
  }
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
  targetLabel: string; // 가게명 또는 "댓글"
  targetSnippet: string | null;
  targetAuthor: string | null;
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

  const postIds = reports.filter((r) => r.targetType === "post").map((r) => r.targetId);
  const commentIds = reports.filter((r) => r.targetType === "comment").map((r) => r.targetId);
  const [posts, comments] = await Promise.all([
    prisma.restaurantPost.findMany({
      where: { id: { in: postIds } },
      select: { id: true, shortReview: true, restaurant: { select: { name: true } }, user: { select: { nickname: true } } },
    }),
    prisma.comment.findMany({
      where: { id: { in: commentIds } },
      select: { id: true, content: true, postId: true, user: { select: { nickname: true } } },
    }),
  ]);
  const postMap = new Map(posts.map((p) => [p.id, p]));
  const commentMap = new Map(comments.map((c) => [c.id, c]));

  return reports.map((r): AdminReportRow => {
    if (r.targetType === "post") {
      const p = postMap.get(r.targetId);
      return {
        id: r.id,
        targetType: r.targetType,
        targetId: r.targetId,
        reason: r.reason,
        detail: r.detail,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        reporterNickname: r.reporter.nickname,
        postId: p?.id ?? null,
        targetExists: !!p,
        targetLabel: p?.restaurant.name ?? "(삭제됨)",
        targetSnippet: p?.shortReview ?? null,
        targetAuthor: p?.user.nickname ?? null,
      };
    }
    const c = commentMap.get(r.targetId);
    return {
      id: r.id,
      targetType: r.targetType,
      targetId: r.targetId,
      reason: r.reason,
      detail: r.detail,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      reporterNickname: r.reporter.nickname,
      postId: c?.postId ?? null,
      targetExists: !!c,
      targetLabel: "댓글",
      targetSnippet: c?.content ?? null,
      targetAuthor: c?.user.nickname ?? null,
    };
  });
}

export async function resolveReport(reportId: string): Promise<void> {
  await prisma.report.update({ where: { id: reportId }, data: { status: "resolved" } });
}

export async function countOpenReports(): Promise<number> {
  return prisma.report.count({ where: { status: "open" } });
}
