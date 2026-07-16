import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveUserId } from "@/lib/auth";
import {
  attachPhoto,
  checkProofGate,
  recordProofAttempt,
  markProofAttempt,
} from "@/server/verification/VerificationService";
import { verifyProofImage, type ProofKind } from "@/server/verification/ImageVerificationService";
import { ABUSE_LIMITS } from "@/server/xp/xpRules";
import { getStorage } from "@/server/storage/StorageService";
import { randomUUID } from "crypto";

const KINDS: ProofKind[] = ["receipt", "menu"];

/** data URL → 스토리지 업로드용 버퍼/타입 */
function parseImage(dataUrl: string): { mime: string; ext: string; buf: Buffer } | null {
  const m = dataUrl.match(/^data:(image\/(jpeg|png|webp));base64,(.+)$/);
  if (!m) return null;
  return { mime: m[1], ext: m[2] === "jpeg" ? "jpg" : m[2], buf: Buffer.from(m[3], "base64") };
}
const BADGE: Record<ProofKind, "receiptVerified" | "menuVerified"> = {
  receipt: "receiptVerified",
  menu: "menuVerified",
};

/**
 * 증거 사진 검증 + 첨부.
 *  - 위치 인증된 본인 글에서만
 *  - 비용/어뷰징 상한: 이미지 크기 / 유저 하루 시도 / 글-슬롯 시도 (AI 호출 전에 검사)
 *  - 영수증만 AI 검증(fail-closed), 음식·메뉴는 위치+현장카메라로 통과 → 통과 시 attachPhoto
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const userId = await getActiveUserId();
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { postId } = await params;

  const body = await req.json().catch(() => ({}));
  const kind = body.kind as ProofKind;
  const image = body.image as string;
  if (!KINDS.includes(kind)) return NextResponse.json({ error: "BAD_KIND" }, { status: 400 });
  if (typeof image !== "string" || !image.startsWith("data:image/")) {
    return NextResponse.json({ error: "BAD_IMAGE" }, { status: 400 });
  }
  // 1) 이미지 크기 상한 (AI 호출 전 토큰 폭탄 차단)
  if (image.length > ABUSE_LIMITS.maxProofImageChars) {
    return NextResponse.json(
      { ok: false, reason: "사진 용량이 너무 커요. 다시 촬영해주세요." },
      { status: 413 }
    );
  }

  const post = await prisma.restaurantPost.findUnique({
    where: { id: postId },
    select: {
      userId: true,
      locationVerified: true,
      receiptVerified: true,
      menuVerified: true,
      restaurant: { select: { name: true } },
    },
  });
  if (!post) return NextResponse.json({ error: "POST_NOT_FOUND" }, { status: 404 });
  if (post.userId !== userId) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (!post.locationVerified) {
    return NextResponse.json({ ok: false, reason: "먼저 위치 인증을 해주세요." });
  }
  // 2) 이미 인증된 항목이면 AI/시도 소모 없이 단축
  if (post[BADGE[kind]]) {
    return NextResponse.json({ ok: true, reason: "이미 인증된 항목이에요.", alreadyDone: true });
  }

  // 3) 시도 상한 게이트 (AI 호출 전)
  const gate = await checkProofGate(userId, postId, kind);
  if (!gate.allowed) {
    return NextResponse.json({ ok: false, reason: gate.reason }, { status: 429 });
  }
  // 시도 기록 (실패해도 카운트되도록 AI 전에 생성)
  const attemptId = await recordProofAttempt(userId, postId, kind);

  // 4) AI/규칙 검증 (base64 는 여기서만 쓰고 DB엔 저장 안 함)
  const verdict = await verifyProofImage(kind, image, post.restaurant.name);
  if (!verdict.ok) {
    return NextResponse.json({ ok: false, reason: verdict.reason });
  }

  // 5) 검증 통과 → 스토리지 업로드 (실패 시에만 올려서 고아 이미지 방지) → DB엔 CDN URL만
  const parsed = parseImage(image);
  if (!parsed) return NextResponse.json({ ok: false, reason: "이미지 형식 오류" }, { status: 400 });
  let storedUrl: string;
  try {
    const up = await getStorage().put(`proofs/${randomUUID()}.${parsed.ext}`, parsed.buf, parsed.mime);
    storedUrl = up.url;
  } catch {
    return NextResponse.json({ ok: false, reason: "사진 저장에 실패했어요. 다시 시도해주세요." }, { status: 500 });
  }

  try {
    const result = await attachPhoto(userId, postId, kind, storedUrl);
    await markProofAttempt(attemptId, true);
    return NextResponse.json({ ok: true, awardedXp: result.awardedXp, reason: verdict.reason });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    const status = msg === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json({ ok: false, reason: "첨부 처리 실패", error: msg }, { status });
  }
}
