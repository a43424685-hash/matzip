import { getCurrentUser } from "@/lib/auth";
import { getBlockedIds } from "@/server/block/BlockService";
import { getActiveRegions } from "@/server/catalog";
import {
  getOverallUserRankingCached,
  getRegionUserRankingCached,
  getOverallRankNeighbors,
} from "@/server/ranking/RankingService";
import BackHomeHeader from "@/components/BackHomeHeader";
import RankingClient, { type MeInfo } from "@/components/RankingClient";

import type { Metadata } from "next";
export const metadata: Metadata = { title: "맛잘알 랭킹" };

export const dynamic = "force-dynamic";

export default async function RankingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; regionId?: string }>;
}) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  const regions = await getActiveRegions();
  const regionId = sp.regionId || regions[0]?.id || "";
  const safeTab = sp.tab === "region" ? "region" : "overall";
  const [neighbors, initialOverall, initialRegion] = await Promise.all([
    user ? getOverallRankNeighbors(user.id) : Promise.resolve(null),
    getOverallUserRankingCached(),
    regionId ? getRegionUserRankingCached(regionId) : Promise.resolve([]),
  ]);

  // 차단한 사용자는 랭킹에서 제외 (캐시는 전역, 표시 시 뷰어별 필터)
  const blocked = user ? new Set(await getBlockedIds(user.id)) : new Set<string>();
  const overall = blocked.size > 0 ? initialOverall.filter((r) => !blocked.has(r.userId)) : initialOverall;
  const region = blocked.size > 0 ? initialRegion.filter((r) => !blocked.has(r.userId)) : initialRegion;

  const me: MeInfo | null = user
    ? {
        userId: user.id,
        overallRank: neighbors?.myRank ?? 0,
        level: user.totalLevel,
        xp: user.totalXp,
        above: neighbors?.above ?? null,
        below: neighbors?.below ?? null,
      }
    : null;

  return (
    <main className="px-5 py-6">
      <BackHomeHeader title="랭킹" />
      <RankingClient
        initialTab={safeTab}
        me={me}
        regions={regions}
        initialRegionId={sp.regionId || regionId}
        initialOverall={overall}
        initialRegion={region}
      />
    </main>
  );
}
