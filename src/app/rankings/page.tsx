import Link from "next/link";
import { Trophy } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getActiveRegions } from "@/server/catalog";
import {
  getOverallUserRanking,
  getRegionUserRanking,
  getWeeklyRestaurantRanking,
  getMyOverallRank,
  type UserRankRow,
} from "@/server/ranking/RankingService";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "overall", label: "전체" },
  { key: "region", label: "지역" },
  { key: "weekly", label: "이번 주 인기" },
];

export default async function RankingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; regionId?: string }>;
}) {
  const sp = await searchParams;
  const tab = sp.tab ?? "overall";
  const user = await getCurrentUser();
  const regions = await getActiveRegions();
  const regionId = sp.regionId || regions[0]?.id || "";

  return (
    <main className="px-5 py-6">
      <h1 className="mb-1 flex items-center gap-2 text-xl font-extrabold text-ink">
        <Trophy size={20} className="text-coral" /> 랭킹
      </h1>
      <p className="mb-4 text-[13px] text-ink-muted">
        진짜 맛집을 아는 사람은 누구일까요?
      </p>

      {/* 탭 */}
      <div className="mb-5 flex gap-1.5">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/rankings?tab=${t.key}`}
            className={t.key === tab ? "chip-on" : "chip-off"}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "overall" && <OverallTab userId={user?.id ?? null} />}
      {tab === "region" && <RegionTab regionId={regionId} regions={regions} />}
      {tab === "weekly" && <WeeklyTab regionId={sp.regionId || null} regions={regions} />}
    </main>
  );
}

/** 순위 배지 — 1위 코랄, 2~3위 포레스트, 그 외 회색 */
function RankBadge({ rank }: { rank: number }) {
  const cls =
    rank === 1
      ? "bg-coral text-white"
      : rank <= 3
        ? "bg-forest-soft text-forest"
        : "bg-stone-100 text-stone-500";
  return <span className={`badge-rank ${cls}`}>{rank}</span>;
}

function UserRow({ row, highlight }: { row: UserRankRow; highlight?: boolean }) {
  return (
    <li
      className={`flex items-center gap-3 p-3.5 ${
        highlight ? "bg-forest-soft" : "bg-white"
      }`}
    >
      <RankBadge rank={row.rank} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold text-ink">{row.nickname}</div>
        <div className="text-[11px] tabular-nums text-stone-400">
          {row.xp.toLocaleString()} XP
        </div>
      </div>
      <span className="badge-lv !px-2 !py-1 !text-xs">Lv.{row.level}</span>
    </li>
  );
}

async function OverallTab({ userId }: { userId: string | null }) {
  const rows = await getOverallUserRanking();
  const myRank = userId ? await getMyOverallRank(userId) : 0;
  return (
    <>
      {userId && myRank > 0 && (
        <div className="mb-3 flex items-center justify-between rounded-xl bg-ink px-4 py-3 text-white">
          <span className="text-[13px] text-white/80">내 현재 순위</span>
          <span className="text-lg font-extrabold tabular-nums">#{myRank}</span>
        </div>
      )}
      <RankList rows={rows} userId={userId} emptyText="아직 랭킹이 없어요. 첫 맛집을 등록해보세요." />
    </>
  );
}

async function RegionTab({
  regionId,
  regions,
}: {
  regionId: string;
  regions: { id: string; name: string }[];
}) {
  const rows = await getRegionUserRanking(regionId);
  return (
    <>
      <form method="get" className="mb-4">
        <input type="hidden" name="tab" value="region" />
        <select name="regionId" defaultValue={regionId} className="input">
          {regions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-ghost mt-2 w-full">
          이 지역 랭킹 보기
        </button>
      </form>
      <RankList rows={rows} userId={null} emptyText="이 지역은 아직 랭킹이 없어요." />
    </>
  );
}

async function WeeklyTab({
  regionId,
  regions,
}: {
  regionId: string | null;
  regions: { id: string; name: string }[];
}) {
  const rows = await getWeeklyRestaurantRanking(regionId);
  return (
    <>
      <form method="get" className="mb-4">
        <input type="hidden" name="tab" value="weekly" />
        <select name="regionId" defaultValue={regionId ?? ""} className="input">
          <option value="">전국</option>
          {regions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-ghost mt-2 w-full">
          필터 적용
        </button>
      </form>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-muted">아직 이번 주 반응이 없어요.</p>
      ) : (
        <ol className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200/80">
          {rows.map((r) => (
            <li key={r.restaurantId} className="flex items-center gap-3 bg-white p-3.5">
              <RankBadge rank={r.rank} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-ink">{r.name}</div>
                <div className="text-[11px] text-stone-400">
                  {r.regionName} · 좋아요 {r.weekLikes} · 저장 {r.weekSaves}
                </div>
              </div>
              <span className="text-sm font-extrabold tabular-nums text-forest">
                {r.score}
                <span className="ml-0.5 text-[11px] font-medium text-stone-400">점</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

function RankList({
  rows,
  userId,
  emptyText,
}: {
  rows: UserRankRow[];
  userId: string | null;
  emptyText: string;
}) {
  if (rows.length === 0)
    return <p className="py-8 text-center text-sm text-ink-muted">{emptyText}</p>;
  return (
    <ol className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200/80">
      {rows.map((r) => (
        <UserRow key={r.userId} row={r} highlight={!!userId && r.userId === userId} />
      ))}
    </ol>
  );
}
