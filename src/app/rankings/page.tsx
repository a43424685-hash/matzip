import { getCurrentUser } from "@/lib/auth";
import { getBlockedIds } from "@/server/block/BlockService";
import { getActiveRegions } from "@/server/catalog";
import {
  getOverallUserRankingCached,
  getRegionUserRankingCached,
  getMyOverallRank,
} from "@/server/ranking/RankingService";
import BackHomeHeader from "@/components/BackHomeHeader";
import RankingClient, { type MeInfo } from "@/components/RankingClient";

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
  const [myRank, initialOverall, initialRegion] = await Promise.all([
    user ? getMyOverallRank(user.id) : Promise.resolve(0),
    getOverallUserRankingCached(),
    regionId ? getRegionUserRankingCached(regionId) : Promise.resolve([]),
  ]);

  // 차단한 사용자는 랭킹에서 제외 (캐시는 전역, 표시 시 뷰어별 필터)
  const blocked = user ? new Set(await getBlockedIds(user.id)) : new Set<string>();
  const overall = blocked.size > 0 ? initialOverall.filter((r) => !blocked.has(r.userId)) : initialOverall;
  const region = blocked.size > 0 ? initialRegion.filter((r) => !blocked.has(r.userId)) : initialRegion;

  const me: MeInfo | null = user
    ? { userId: user.id, overallRank: myRank, level: user.totalLevel, xp: user.totalXp }
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
