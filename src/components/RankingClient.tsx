"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { UserRankRow, RankNeighbor } from "@/server/ranking/RankingService";

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
  above: RankNeighbor | null;
  below: RankNeighbor | null;
}

type RefCb = (el: HTMLElement | null) => void;

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
  const [myRowVisible, setMyRowVisible] = useState(false);

  // 내 실제 줄(또는 포디움)이 화면에 보이는지 감지 → 보이면 하단 카드 흡수(숨김)
  const observerRef = useRef<IntersectionObserver | null>(null);
  const setMeRow = useCallback<RefCb>((el) => {
    observerRef.current?.disconnect();
    if (!el) {
      setMyRowVisible(false);
      return;
    }
    const obs = new IntersectionObserver(([entry]) => setMyRowVisible(entry.isIntersecting), { threshold: 0.5 });
    obs.observe(el);
    observerRef.current = obs;
  }, []);

  async function fetchRows(nextTab: TabKey, nextRegionId = regionId) {
    setTab(nextTab);
    setMyRowVisible(false);
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

      <RankList
        rows={rows}
        meId={me?.userId ?? null}
        setMeRow={setMeRow}
        emptyText={tab === "overall" ? "아직 랭킹이 없어요. 첫 맛집을 등록해보세요." : "이 지역은 아직 랭킹이 없어요."}
      />

      {me && <MyRankBar rows={rows} me={me} tab={tab} myRowVisible={myRowVisible} />}
    </section>
  );
}

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

function RankList({ rows, meId, setMeRow, emptyText }: { rows: UserRankRow[]; meId: string | null; setMeRow: RefCb; emptyText: string }) {
  if (rows.length === 0) return <p className="py-10 text-center text-sm text-ink-muted">{emptyText}</p>;
  const top = rows.slice(0, 3);
  const rest = rows.slice(3);
  return (
    <>
      <Podium rows={top} meId={meId} setMeRow={setMeRow} />
      {rest.length > 0 && (
        <ol className="mt-5 space-y-1.5 pb-2">
          {rest.map((row) => {
            const isMe = !!meId && row.userId === meId;
            return <UserRow key={row.userId} row={row} highlight={isMe} cardRef={isMe ? setMeRow : undefined} />;
          })}
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

function Podium({ rows, meId, setMeRow }: { rows: UserRankRow[]; meId: string | null; setMeRow: RefCb }) {
  if (rows.length === 0) return null;
  const refFor = (r?: UserRankRow) => (!!meId && r?.userId === meId ? setMeRow : undefined);
  return (
    <section className="grid grid-cols-3 items-end gap-2">
      <PodiumCard row={rows[1]} place={2} me={!!meId && rows[1]?.userId === meId} cardRef={refFor(rows[1])} />
      <PodiumCard row={rows[0]} place={1} me={!!meId && rows[0]?.userId === meId} cardRef={refFor(rows[0])} />
      <PodiumCard row={rows[2]} place={3} me={!!meId && rows[2]?.userId === meId} cardRef={refFor(rows[2])} />
    </section>
  );
}

function PodiumCard({ row, place, me, cardRef }: { row?: UserRankRow; place: 1 | 2 | 3; me?: boolean; cardRef?: RefCb }) {
  if (!row) return <div />;
  const s = PODIUM[place];
  return (
    <div ref={cardRef}>
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
        <div className={`mt-2 flex w-full items-start justify-center rounded-t-xl pt-1 text-lg font-black text-white/90 ${s.ped}`}>{place}</div>
      </Link>
    </div>
  );
}

function UserRow({ row, highlight, cardRef }: { row: UserRankRow; highlight?: boolean; cardRef?: RefCb }) {
  const isTop10 = row.rank <= 10;
  return (
    <li ref={cardRef}>
      <Link
        href={`/u/${row.userId}`}
        className={`flex items-center gap-3 rounded-2xl px-3.5 py-2.5 ${
          highlight ? "bg-forest text-white" : isTop10 ? "border border-amber-200 bg-amber-50/60" : "bg-white"
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
        <span className={`rounded-lg px-2.5 py-1 text-[15px] font-black ${highlight ? "bg-white/20 text-white" : "bg-forest-soft text-forest"}`}>Lv.{row.level}</span>
      </Link>
    </li>
  );
}

/** 하단 고정 바.
 *  - 100위 안: 내 카드만. 내 실제 줄이 화면에 보이면 흡수(숨김).
 *  - 100위 밖: 내 앞뒤 이웃 포함 바(내 위치 가늠용), 항상 표시. */
function MyRankBar({ rows, me, tab, myRowVisible }: { rows: UserRankRow[]; me: MeInfo; tab: TabKey; myRowVisible: boolean }) {
  const idx = rows.findIndex((r) => r.userId === me.userId);
  const inList = idx >= 0;
  const bottom = "bottom-[calc(4rem_+_env(safe-area-inset-bottom))]";

  // 100위 안 — 내 카드만, 내 줄 보이면 숨김
  if (inList) {
    if (myRowVisible) return null;
    const r = rows[idx];
    return (
      <div className={`sticky ${bottom} z-30 pt-2`}>
        <div className="flex items-center gap-3 rounded-2xl bg-forest px-3.5 py-2.5 text-white shadow-[0_12px_30px_rgba(0,0,0,.3)]">
          <span className="w-6 shrink-0 text-center text-base font-black tabular-nums">{r.rank}</span>
          <Avatar url={r.avatarUrl} name={r.nickname} className="h-9 w-9" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-bold">{r.nickname}</span>
              <span className="shrink-0 rounded-full bg-white/25 px-1.5 py-0.5 text-[10px] font-bold">나</span>
            </div>
            <div className="text-[11px] tabular-nums text-white/70">{r.xp.toLocaleString()} XP</div>
          </div>
          <span className="shrink-0 rounded-lg bg-white/20 px-2.5 py-1 text-sm font-black">Lv.{r.level}</span>
        </div>
      </div>
    );
  }

  // 100위 밖 — 이웃 포함 (전체 탭에서만 이웃 데이터 있음)
  const showNeighbors = tab === "overall" && me.overallRank > 0;
  return (
    <div className={`sticky ${bottom} z-30 pt-2`}>
      <div className="rounded-2xl bg-ink/95 px-3 py-2.5 text-white shadow-[0_12px_30px_rgba(0,0,0,.3)] backdrop-blur">
        <div className="mb-1 px-1 text-[10px] font-bold text-white/50">내 순위</div>
        <div className="flex items-stretch gap-1.5">
          {showNeighbors && <NeighborCell n={me.above} />}
          <div className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-forest px-2 py-1.5">
            <span className="text-base font-black tabular-nums">{me.overallRank > 0 ? `#${me.overallRank}` : "순위권 밖"}</span>
            <span className="text-[11px] font-bold text-white/70">Lv.{me.level}</span>
          </div>
          {showNeighbors && <NeighborCell n={me.below} />}
        </div>
      </div>
    </div>
  );
}

function NeighborCell({ n }: { n: RankNeighbor | null }) {
  if (!n) return <div className="flex-1" />;
  return (
    <div className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/10 px-2 py-1.5 opacity-75">
      <span className="text-[11px] font-black tabular-nums text-white/80">#{n.rank}</span>
      <span className="max-w-[3.5rem] truncate text-[11px] text-white/70">{n.nickname}</span>
      <span className="text-[10px] font-bold text-white/50">Lv.{n.level}</span>
    </div>
  );
}
