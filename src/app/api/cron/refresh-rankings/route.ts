import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { revalidateTag } from "next/cache";
import { refreshRankingCache } from "@/server/ranking/RankingService";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * 랭킹 배치 — Vercel Cron 이 주기적으로 호출 (vercel.json crons).
 *  - DB RankingCache 스냅샷 적재 + 랭킹 Data Cache 무효화(revalidateTag)
 * 보호:
 *  - CRON_SECRET 이 설정돼 있으면 Authorization: Bearer <CRON_SECRET> 일치 필요(timing-safe).
 *  - 운영(production)에서 CRON_SECRET 이 없으면 거부(설정 누락 = 공개 금지).
 *  (Vercel Cron 은 CRON_SECRET 설정 시 자동으로 이 헤더를 붙여 호출함)
 */
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ ok: false, reason: "CRON_SECRET_NOT_SET" }, { status: 403 });
    }
    // 개발 환경에서는 시크릿 없이도 허용
  } else if (!safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ ok: false, reason: "FORBIDDEN" }, { status: 403 });
  }

  try {
    await refreshRankingCache();
    revalidateTag("rankings");
    return NextResponse.json({ ok: true, refreshedAt: new Date().toISOString() });
  } catch (e) {
    console.error("[CRON refresh-rankings]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "REFRESH_FAILED" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
