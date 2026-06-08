import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { refreshRankingCache } from "@/server/ranking/RankingService";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 랭킹 배치 — Vercel Cron 이 주기적으로 호출 (vercel.json crons).
 *  - DB RankingCache 스냅샷 적재
 *  - 랭킹 Data Cache 무효화(revalidateTag) → 다음 조회 시 최신 재계산
 * 보호: CRON_SECRET 환경변수가 있으면 Authorization: Bearer <CRON_SECRET> 일치 필요.
 * (Vercel Cron 은 CRON_SECRET 설정 시 자동으로 이 헤더를 붙여 호출함)
 */
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, reason: "FORBIDDEN" }, { status: 401 });
    }
  }
  try {
    await refreshRankingCache();
    revalidateTag("rankings");
    return NextResponse.json({ ok: true, refreshedAt: new Date().toISOString() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
