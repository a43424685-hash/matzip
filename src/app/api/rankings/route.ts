import { NextResponse } from "next/server";
import {
  getOverallUserRankingCached,
  getRegionUserRankingCached,
  getWeeklyRestaurantRankingCached,
} from "@/server/ranking/RankingService";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tab = url.searchParams.get("tab") || "overall";
  const regionId = url.searchParams.get("regionId") || null;

  if (tab === "overall") {
    return NextResponse.json({ ok: true, rows: await getOverallUserRankingCached() });
  }
  if (tab === "region") {
    if (!regionId) return NextResponse.json({ ok: false, error: "REGION_REQUIRED" }, { status: 400 });
    return NextResponse.json({ ok: true, rows: await getRegionUserRankingCached(regionId) });
  }
  if (tab === "weekly") {
    return NextResponse.json({ ok: true, rows: await getWeeklyRestaurantRankingCached(regionId) });
  }

  return NextResponse.json({ ok: false, error: "BAD_TAB" }, { status: 400 });
}
