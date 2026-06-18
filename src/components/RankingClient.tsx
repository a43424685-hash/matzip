"use client";

import { useMemo, useState } from "react";
import { Crown, Medal } from "lucide-react";
import type { UserRankRow } from "@/server/ranking/RankingService";

type TabKey = "overall" | "region";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overall", label: "전체" },
  { key: "region", label: "지역" },
];

export default function RankingClient({
  initialTab,
  userId,
  regions,
  initialRegionId,
  initialOverall,
  initialRegion,
}: {
  initialTab: TabKey;
  userId: string | null;
  regions: { id: string; name: string }[];
  initialRegionId: string;
  initialOverall: UserRankRow[];
  initialRegion: UserRankRow[];
}) {
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [regionId, setRegionId] = useState(initialRegionId);
  const [overallRows] = useState(initialOverall);
  const [regionRows, setRegionRows] = useState(initialRegion);
  const [loading, setLoading] = useState(false);

  async function fetchRows(nextTab: TabKey, nextRegionId = regionId) {
    setTab(nextTab);
    if (nextTab === "overall") return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ tab: nextTab });
      if (nextRegionId) params.set("regionId", nextRegionId);
      const res = await fetch(`/api/rankings?${params.toString()}`);
      const data = (await res.json()) as { ok?: boolean; rows?: UserRankRow[] };
      if (res.ok && data.ok) setRegionRows((data.rows ?? []) as UserRankRow[]);
    } finally {
      setLoading(false);
    }
  }

  async function changeRegion(nextRegionId: string) {
    setRegionId(nextRegionId);
    await fetchRows(tab, nextRegionId);
  }

  const regionValue = useMemo(() => regionId || regions[0]?.id || "", [regionId, regions]);

  return (
    <section className="mt-6">
      <div className="mb-3 flex gap-1.5">
        {TABS.map((item) => (
          <button key={item.key} type="button" onClick={() => fetchRows(item.key)} className={item.key === tab ? "chip-on" : "chip-off"}>
            {item.label}
          </button>
        ))}
      </div>

      {tab === "region" && (
        <select value={regionValue} onChange={(e) => changeRegion(e.target.value)} className="input mb-4">
          {regions.map((region) => (
            <option key={region.id} value={region.id}>
              {region.name}
            </option>
          ))}
        </select>
      )}

      {loading && <p className="mb-3 text-center text-[12px] text-stone-400">불러오는 중...</p>}
      {tab === "overall" && <RankList rows={overallRows} userId={userId} emptyText="아직 랭킹이 없어요. 첫 맛집을 등록해보세요." />}
      {tab === "region" && <RankList rows={regionRows} userId={null} emptyText="이 지역은 아직 랭킹이 없어요." />}
    </section>
  );
}

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
    <li className={`flex items-center gap-3 p-3.5 ${highlight ? "bg-forest-soft" : "bg-white"}`}>
      <RankBadge rank={row.rank} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold text-ink">{row.nickname}</div>
        <div className="text-[11px] tabular-nums text-stone-400">
          {row.xp.toLocaleString()} XP · 최근 30일 {row.recent30dXp.toLocaleString()} XP
        </div>
      </div>
      <span className="badge-lv !px-2 !py-1 !text-xs">Lv.{row.level}</span>
    </li>
  );
}

function RankList({ rows, userId, emptyText }: { rows: UserRankRow[]; userId: string | null; emptyText: string }) {
  if (rows.length === 0) return <p className="py-8 text-center text-sm text-ink-muted">{emptyText}</p>;
  const top = rows.slice(0, 3);
  const rest = rows.slice(3);
  return (
    <>
      <Podium rows={top} />
      <ol className="mt-4 divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200/80">
        {rest.map((row) => (
          <UserRow key={row.userId} row={row} highlight={!!userId && row.userId === userId} />
        ))}
      </ol>
    </>
  );
}

function Podium({ rows }: { rows: UserRankRow[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="grid grid-cols-3 items-end gap-2">
      <PodiumCard row={rows[1]} height="pt-5" />
      <PodiumCard row={rows[0]} height="pt-2 pb-5" primary />
      <PodiumCard row={rows[2]} height="pt-7" />
    </section>
  );
}

function PodiumCard({ row, height, primary }: { row?: UserRankRow; height: string; primary?: boolean }) {
  if (!row) return <div />;
  return (
    <div className={`rounded-2xl border ${primary ? "border-coral bg-coral/10" : "border-stone-200 bg-white"} px-2.5 pb-3 text-center ${height}`}>
      <div className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full ${primary ? "bg-coral text-white" : "bg-forest-soft text-forest"}`}>
        {primary ? <Crown size={18} /> : <Medal size={17} />}
      </div>
      <div className="mt-2 text-[12px] font-black text-ink">#{row.rank}</div>
      <div className="mt-0.5 truncate text-[12px] font-bold text-ink">{row.nickname}</div>
      <div className="mt-1 text-[11px] text-stone-400">Lv.{row.level}</div>
    </div>
  );
}
