import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { addComment, getComments } from "@/server/comment/CommentService";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const userId = await getSessionUserId();
  const { postId } = await params;
  const comments = await getComments(postId, userId);
  return NextResponse.json({ comments });
}

const MSG: Record<string, string> = {
  EMPTY: "내용을 입력하세요.",
  TOO_LONG: "댓글이 너무 길어요.",
  DAILY_CAP: "오늘 댓글 한도를 초과했어요.",
  DUPLICATE: "같은 내용을 연속으로 달 수 없어요.",
  PROFANITY: "욕설·부적절한 표현은 사용할 수 없어요.",
  REPLY_DEPTH: "답글에는 답글을 달 수 없어요.",
  BAD_PARENT: "잘못된 답글 대상이에요.",
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { postId } = await params;
  const body = await req.json().catch(() => ({}));

  try {
    const r = await addComment(userId, postId, String(body.content ?? ""), body.parentId ?? null);
    return NextResponse.json({ ok: true, id: r.id });
  } catch (e) {
    const code = e instanceof Error ? e.message : "ERROR";
    const status = code === "POST_NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ ok: false, reason: MSG[code] || "댓글 작성에 실패했어요." }, { status });
  }
}
