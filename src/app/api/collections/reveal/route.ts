import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { recordReveal } from "@/server/payment/PaymentService";

/**
 * 유료 지도 구매 후 '가게 열람' 기록.
 * 맛보기 외 가게를 열 때 호출 → 열람 수 카운트. 임계치 넘으면 단순변심 환불 창이 닫힌다.
 */
export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const collectionId = String(body.collectionId ?? "");
  const restaurantId = String(body.restaurantId ?? "");
  if (!collectionId || !restaurantId) {
    return NextResponse.json({ ok: false, reason: "BAD_REQUEST" }, { status: 400 });
  }
  const r = await recordReveal(userId, collectionId, restaurantId);
  return NextResponse.json(r);
}
