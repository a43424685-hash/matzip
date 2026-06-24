"use client";

import { useMemo, useState } from "react";
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
      {tab === "region" && <RankList rows={regionRows} userId={userId} emptyText="이 지역은 아직 랭킹이 없어요." />}
    </section>
  );
}

/** 프로필 사진(없으면 닉네임 첫 글자). me 페이지와 동일하게 <img> 사용. */
function Avatar({ url, name, className, ring }: { url: string | null; name: string; className: string; ring?: string }) {
  return (
    <div className={`relative shrink-0 overflow-hidden rounded-full bg-forest-soft ${ring ?? ""} ${className}`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center font-black text-forest">{name.slice(0, 1)}</span>
      )}
    </div>
  );
}

function RankList({ rows, userId, emptyText }: { rows: UserRankRow[]; userId: string | null; emptyText: string }) {
  if (rows.length === 0) return <p className="py-8 text-center text-sm text-ink-muted">{emptyText}</p>;
  const top = rows.slice(0, 3);
  const rest = rows.slice(3);
  return (
    <>
      <Podium rows={top} userId={userId} />
      {rest.length > 0 && (
        <ol className="mt-4 divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200/80">
          {rest.map((row) => (
            <UserRow key={row.userId} row={row} highlight={!!userId && row.userId === userId} />
          ))}
        </ol>
      )}
    </>
  );
}

const PODIUM = {
  1: { medal: "🥇", ring: "ring-amber-400", ped: "h-24 bg-gradient-to-b from-amber-300 to-amber-400", av: "h-20 w-20", glow: "shadow-[0_10px_28px_rgba(251,191,36,.45)]" },
  2: { medal: "🥈", ring: "ring-slate-300", ped: "h-16 bg-gradient-to-b from-slate-200 to-slate-300", av: "h-16 w-16", glow: "" },
  3: { medal: "🥉", ring: "ring-orange-300", ped: "h-12 bg-gradient-to-b from-orange-200 to-orange-300", av: "h-16 w-16", glow: "" },
} as const;

function Podium({ rows, userId }: { rows: UserRankRow[]; userId: string | null }) {
  if (rows.length === 0) return null;
  return (
    <section className="grid grid-cols-3 items-end gap-2 rounded-3xl bg-gradient-to-b from-forest/5 to-transparent px-2 pt-4">
      <PodiumCard row={rows[1]} place={2} me={!!userId && rows[1]?.userId === userId} />
      <PodiumCard row={rows[0]} place={1} me={!!userId && rows[0]?.userId === userId} />
      <PodiumCard row={rows[2]} place={3} me={!!userId && rows[2]?.userId === userId} />
    </section>
  );
}

function PodiumCard({ row, place, me }: { row?: UserRankRow; place: 1 | 2 | 3; me?: boolean }) {
  if (!row) return <div />;
  const s = PODIUM[place];
  return (
    <div className="flex flex-col items-center">
      {place === 1 && <div className="mb-0.5 text-xl leading-none">👑</div>}
      <div className="relative">
        <Avatar url={row.avatarUrl} name={row.nickname} className={`${s.av} ring-4 ${s.ring} ${s.glow}`} />
        <span className="absolute -bottom-1 -right-1 text-lg leading-none drop-shadow">{s.medal}</span>
      </div>
      <div className="mt-2 flex max-w-full items-center gap-1">
        <span className="truncate text-[13px] font-extrabold text-ink">{row.nickname}</span>
        {me && <span className="rounded-full bg-forest px-1.5 py-0.5 text-[9px] font-bold text-white">나</span>}
      </div>
      <div className="text-[12px] font-black text-forest">Lv.{row.level}</div>
      <div className="text-[10px] tabular-nums text-stone-400">{row.xp.toLocaleString()} XP</div>
      <div className={`mt-2 flex w-full items-start justify-center rounded-t-xl pt-1.5 text-base font-black text-white/90 ${s.ped}`}>
        {place}
      </div>
    </div>
  );
}

function UserRow({ row, highlight }: { row: UserRankRow; highlight?: boolean }) {
  return (
    <li className={`flex items-center gap-3 px-3.5 py-3 ${highlight ? "bg-forest-soft" : "bg-white"}`}>
      <span className="w-7 shrink-0 text-center text-sm font-black tabular-nums text-stone-400">{row.rank}</span>
      <Avatar url={row.avatarUrl} name={row.nickname} className="h-10 w-10" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-bold text-ink">{row.nickname}</span>
          {highlight && <span className="rounded-full bg-forest px-1.5 py-0.5 text-[10px] font-bold text-white">나</span>}
        </div>
        <div className="text-[11px] tabular-nums text-stone-400">{row.xp.toLocaleString()} XP</div>
      </div>
      <span className="rounded-lg bg-forest-soft px-2.5 py-1 text-sm font-black text-forest">Lv.{row.level}</span>
    </li>
  );
}
