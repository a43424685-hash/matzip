import { NextResponse } from "next/server";
import { geocodePlace } from "@/lib/kakaoGeocode";

export const dynamic = "force-dynamic";

/**
 * 검색어 → 좌표 + (장소면) 상호·주소·카테고리. 인증 불필요.
 * "수유역 5번출구", "강릉", "강남 노포" 등 무엇이든 카카오가 해석.
 */
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ ok: false });
  const p = await geocodePlace(q);
  return p
    ? NextResponse.json({
        ok: true,
        lat: p.lat,
        lng: p.lng,
        placeName: p.placeName,
        address: p.address,
        roadAddress: p.roadAddress,
        category: p.category,
      })
    : NextResponse.json({ ok: false });
}
