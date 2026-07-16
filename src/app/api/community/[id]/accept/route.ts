import { NextResponse } from "next/server";
import { getActiveUserId } from "@/lib/auth";
import { acceptCommunityAnswer } from "@/server/community/CommunityService";

// Q&A 답변 채택 — 질문 작성자만
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getActiveUserId();
  if (!userId) return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const commentId = String(body.commentId ?? "");
  if (!commentId) return NextResponse.json({ ok: false, reason: "BAD_REQUEST" }, { status: 400 });
  const r = await acceptCommunityAnswer(userId, id, commentId);
  if (!r.ok) return NextResponse.json(r, { status: r.reason === "FORBIDDEN" ? 403 : 400 });
  return NextResponse.json({ ok: true });
}
