import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { verifyLocation } from "@/server/verification/VerificationService";

/**
 * 위치 인증 전용 엔드포인트.
 * 사진/영수증/메뉴판 증거 첨부는 여기서 받지 않는다 — 반드시 /proof (카메라+AI 검증)로만.
 * (이 라우트로 증거를 직접 붙여 AI/카메라 검증을 우회하는 것을 차단)
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { postId } = await params;
  const body = await req.json();

  if (body.type !== "location") {
    return NextResponse.json({ error: "BAD_TYPE" }, { status: 400 });
  }

  try {
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ error: "BAD_COORDS" }, { status: 400 });
    }
    const result = await verifyLocation(userId, postId, {
      lat,
      lng,
      accuracy: body.accuracy ?? null,
    });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    const status = msg === "FORBIDDEN" ? 403 : msg === "POST_NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
