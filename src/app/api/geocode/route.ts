import { NextResponse } from "next/server";
import { geocodeKeyword } from "@/lib/kakaoGeocode";

export const dynamic = "force-dynamic";

/**
 * 검색어 → 좌표 (지도 이동용). 인증 불필요.
 * "수유역 5번출구", "강릉", "강남 노포" 등 무엇이든 카카오가 좌표로 해석.
 */
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ ok: false });
  const c = await geocodeKeyword(q);
  return c
    ? NextResponse.json({ ok: true, lat: c.lat, lng: c.lng })
    : NextResponse.json({ ok: false });
}
