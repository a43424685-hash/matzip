"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { UserRankRow } from "@/server/ranking/RankingService";

type TabKey = "overall" | "region";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overall", label: "전체" },
  { key: "region", label: "지역" },
];

export interface MeInfo {
  userId: string;
  overallRank: number;
  level: number;
  xp: number;
}

export default function RankingClient({
  initialTab,
  me,
  regions,
  initialRegionId,
  initialOverall,
  initialRegion,
}: {
  initialTab: TabKey;
  me: MeInfo | null;
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
  const rows = tab === "overall" ? overallRows : regionRows;

  return (
    <section className="mt-2">
      <div className="mb-4 flex gap-1.5">
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

      <RankList rows={rows} meId={me?.userId ?? null} emptyText={tab === "overall" ? "아직 랭킹이 없어요. 첫 맛집을 등록해보세요." : "이 지역은 아직 랭킹이 없어요."} />

      {me && <MyRankBar rows={rows} me={me} tab={tab} />}
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

function RankList({ rows, meId, emptyText }: { rows: UserRankRow[]; meId: string | null; emptyText: string }) {
  if (rows.length === 0) return <p className="py-10 text-center text-sm text-ink-muted">{emptyText}</p>;
  const top = rows.slice(0, 3);
  const rest = rows.slice(3);
  return (
    <>
      <Podium rows={top} meId={meId} />
      {rest.length > 0 && (
        <ol className="mt-5 space-y-1.5 pb-2">
          {rest.map((row) => (
            <UserRow key={row.userId} row={row} highlight={!!meId && row.userId === meId} />
          ))}
        </ol>
      )}
    </>
  );
}

const PODIUM = {
  1: { medal: "🥇", ring: "ring-amber-400", ped: "h-20 bg-gradient-to-b from-amber-300 to-amber-400", av: "h-[4.5rem] w-[4.5rem]", glow: "shadow-[0_12px_30px_rgba(251,191,36,.5)]" },
  2: { medal: "🥈", ring: "ring-slate-300", ped: "h-14 bg-gradient-to-b from-slate-200 to-slate-300", av: "h-16 w-16", glow: "" },
  3: { medal: "🥉", ring: "ring-amber-600/60", ped: "h-10 bg-gradient-to-b from-amber-600/40 to-amber-700/40", av: "h-16 w-16", glow: "" },
} as const;

function Podium({ rows, meId }: { rows: UserRankRow[]; meId: string | null }) {
  if (rows.length === 0) return null;
  return (
    <section className="grid grid-cols-3 items-end gap-2">
      <PodiumCard row={rows[1]} place={2} me={!!meId && rows[1]?.userId === meId} />
      <PodiumCard row={rows[0]} place={1} me={!!meId && rows[0]?.userId === meId} />
      <PodiumCard row={rows[2]} place={3} me={!!meId && rows[2]?.userId === meId} />
    </section>
  );
}

function PodiumCard({ row, place, me }: { row?: UserRankRow; place: 1 | 2 | 3; me?: boolean }) {
  if (!row) return <div />;
  const s = PODIUM[place];
  return (
    <Link href={`/u/${row.userId}`} className="flex flex-col items-center">
      {place === 1 && <div className="mb-1 text-2xl leading-none">👑</div>}
      <div className="relative">
        <Avatar url={row.avatarUrl} name={row.nickname} className={`${s.av} ring-[3px] ${s.ring} ${s.glow}`} />
        <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 text-xl leading-none drop-shadow">{s.medal}</span>
      </div>
      <div className="mt-2.5 flex max-w-full items-center gap-1">
        <span className="truncate text-[13px] font-extrabold text-ink">{row.nickname}</span>
        {me && <span className="shrink-0 rounded-full bg-forest px-1.5 py-0.5 text-[9px] font-bold text-white">나</span>}
      </div>
      <div className="mt-0.5 text-[13px] font-black text-forest">Lv.{row.level}</div>
      <div className="text-[10px] tabular-nums text-stone-400">{row.xp.toLocaleString()} XP</div>
      <div className={`mt-2 flex w-full items-start justify-center rounded-t-xl pt-1 text-lg font-black text-white/90 ${s.ped}`}>
        {place}
      </div>
    </Link>
  );
}

function UserRow({ row, highlight }: { row: UserRankRow; highlight?: boolean }) {
  const isTop10 = row.rank <= 10;
  return (
    <li>
      <Link
        href={`/u/${row.userId}`}
        className={`flex items-center gap-3 rounded-2xl px-3.5 py-2.5 ${
          highlight
            ? "bg-forest text-white"
            : isTop10
              ? "border border-amber-200 bg-amber-50/60"
              : "bg-white"
        }`}
      >
        <span className={`w-6 shrink-0 text-center text-base font-black tabular-nums ${highlight ? "text-white" : isTop10 ? "text-amber-500" : "text-stone-400"}`}>
          {row.rank}
        </span>
      <Avatar url={row.avatarUrl} name={row.nickname} className="h-11 w-11" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[15px] font-bold">{row.nickname}</span>
          {highlight && <span className="shrink-0 rounded-full bg-white/25 px-1.5 py-0.5 text-[10px] font-bold">나</span>}
        </div>
        <div className={`text-[11px] tabular-nums ${highlight ? "text-white/70" : "text-stone-400"}`}>{row.xp.toLocaleString()} XP</div>
      </div>
        <span className={`rounded-lg px-2.5 py-1 text-[15px] font-black ${highlight ? "bg-white/20 text-white" : "bg-forest-soft text-forest"}`}>
          Lv.{row.level}
        </span>
      </Link>
    </li>
  );
}

/** 하단 고정 — 내 순위 + 바로 위/아래 이웃 (스크롤해도 항상 보임). */
function MyRankBar({ rows, me, tab }: { rows: UserRankRow[]; me: MeInfo; tab: TabKey }) {
  const idx = rows.findIndex((r) => r.userId === me.userId);
  const inList = idx >= 0;
  const above = inList && idx > 0 ? rows[idx - 1] : null;
  const below = inList && idx < rows.length - 1 ? rows[idx + 1] : null;
  const myRank = inList ? rows[idx].rank : tab === "overall" ? me.overallRank : 0;
  const myLevel = inList ? rows[idx].level : me.level;

  return (
    <div className="sticky bottom-[5.5rem] z-30 mt-4">
      <div className="rounded-2xl bg-ink/95 px-3 py-2.5 text-white shadow-[0_10px_30px_rgba(0,0,0,.28)] backdrop-blur">
        <div className="mb-1 px-1 text-[10px] font-bold text-white/50">내 순위</div>
        <div className="flex items-stretch gap-1.5">
          <NeighborCell row={above} dim />
          <div className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-forest px-2 py-1.5">
            <span className="text-base font-black tabular-nums">{myRank > 0 ? `#${myRank}` : "순위권 밖"}</span>
            <span className="text-[11px] font-bold text-white/70">Lv.{myLevel}</span>
          </div>
          <NeighborCell row={below} dim />
        </div>
      </div>
    </div>
  );
}

function NeighborCell({ row, dim }: { row: UserRankRow | null; dim?: boolean }) {
  if (!row) return <div className="flex-1" />;
  return (
    <div className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/10 px-2 py-1.5 ${dim ? "opacity-70" : ""}`}>
      <span className="text-[11px] font-black tabular-nums text-white/80">#{row.rank}</span>
      <span className="max-w-[3.5rem] truncate text-[11px] text-white/70">{row.nickname}</span>
      <span className="text-[10px] font-bold text-white/50">Lv.{row.level}</span>
    </div>
  );
}
