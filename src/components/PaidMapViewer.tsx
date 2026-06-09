"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { List, Map as MapIcon, Navigation, Bookmark, Check, Store, Trophy } from "lucide-react";
import { loadKakaoMaps } from "@/lib/kakaoLoader";
import type { CollectionDetail } from "@/server/collection/CollectionService";
import CardImage from "@/components/CardImage";
import VerificationBadges from "@/components/VerificationBadges";

type Item = CollectionDetail["items"][number];

export default function PaidMapViewer({
  collectionId,
  items,
  regionCounts,
  initialVisited,
  initialSaved,
  canTrack,
}: {
  collectionId: string;
  items: Item[];
  regionCounts: { name: string; count: number }[];
  initialVisited: string[];
  initialSaved: string[];
  canTrack: boolean;
}) {
  const [view, setView] = useState<"list" | "map">("list");
  const [region, setRegion] = useState<string>("전체");
  const [visited, setVisited] = useState<Set<string>>(new Set(initialVisited));
  const [saved, setSaved] = useState<Set<string>>(new Set(initialSaved));

  const mapBoxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRefs = useRef<any[]>([]);
  const [mapError, setMapError] = useState<string | null>(null);

  const multiRegion = regionCounts.length > 1;
  const filtered = useMemo(
    () => (region === "전체" ? items : items.filter((i) => i.regionName === region)),
    [items, region]
  );
  const geoItems = useMemo(
    () => filtered.filter((i) => Number.isFinite(i.latitude) && Number.isFinite(i.longitude)),
    [filtered]
  );

  // 지도 초기화 (지도 보기로 전환됐을 때 1회)
  useEffect(() => {
    if (view !== "map" || mapRef.current) return;
    let cancelled = false;
    loadKakaoMaps()
      .then(() => {
        if (cancelled || !mapBoxRef.current) return;
        const kakao = window.kakao;
        const first = geoItems[0];
        const center = first
          ? new kakao.maps.LatLng(first.latitude, first.longitude)
          : new kakao.maps.LatLng(37.5665, 126.978);
        mapRef.current = new kakao.maps.Map(mapBoxRef.current, { center, level: 6 });
        plotMarkers();
      })
      .catch((e: Error) => {
        if (!cancelled) setMapError(e.message === "NO_KEY" ? "지도 키가 필요해요." : "지도를 불러오지 못했어요.");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // 필터 바뀌면 마커 다시 그림
  useEffect(() => {
    if (view === "map" && mapRef.current) plotMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoItems, view]);

  function plotMarkers() {
    const kakao = window.kakao;
    const map = mapRef.current;
    if (!kakao || !map) return;
    markerRefs.current.forEach((m) => m.setMap(null));
    markerRefs.current = [];
    if (geoItems.length === 0) return;

    const bounds = new kakao.maps.LatLngBounds();
    geoItems.forEach((it, idx) => {
      const pos = new kakao.maps.LatLng(it.latitude, it.longitude);
      bounds.extend(pos);
      const done = visited.has(it.restaurantId);
      const overlay = new kakao.maps.CustomOverlay({
        position: pos,
        yAnchor: 1.1,
        content: `
          <a href="${it.postId ? `/restaurants/${it.postId}` : "#"}" style="
            display:inline-flex;align-items:center;gap:4px;
            padding:5px 10px;border-radius:999px;
            background:${done ? "#1f4d3f" : "#ffffff"};color:${done ? "#fff" : "#1f2b25"};
            border:1px solid rgba(31,61,43,.2);font-size:12px;font-weight:800;
            box-shadow:0 4px 12px rgba(0,0,0,.18);white-space:nowrap;text-decoration:none;">
            ${idx + 1}. ${escapeHtml(it.restaurantName)}
          </a>`,
        map,
      });
      markerRefs.current.push(overlay);
    });
    map.setBounds(bounds, 40, 40, 40, 40);
  }

  async function toggleVisited(it: Item) {
    if (!canTrack) return;
    const next = !visited.has(it.restaurantId);
    setVisited((s) => {
      const n = new Set(s);
      if (next) n.add(it.restaurantId);
      else n.delete(it.restaurantId);
      return n;
    });
    try {
      await fetch("/api/collections/visit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collectionId, restaurantId: it.restaurantId, visited: next }),
      });
    } catch {
      // 실패 시 롤백
      setVisited((s) => {
        const n = new Set(s);
        if (next) n.delete(it.restaurantId);
        else n.add(it.restaurantId);
        return n;
      });
    }
  }

  async function toggleSaved(it: Item) {
    if (!canTrack) return;
    const next = !saved.has(it.restaurantId);
    setSaved((s) => {
      const n = new Set(s);
      if (next) n.add(it.restaurantId);
      else n.delete(it.restaurantId);
      return n;
    });
    try {
      await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: it.restaurantId, postId: it.postId }),
      });
    } catch {
      setSaved((s) => {
        const n = new Set(s);
        if (next) n.delete(it.restaurantId);
        else n.add(it.restaurantId);
        return n;
      });
    }
  }

  const visitedCount = items.filter((i) => visited.has(i.restaurantId)).length;
  const pct = items.length > 0 ? Math.round((visitedCount / items.length) * 100) : 0;

  return (
    <div className="mt-5">
      {/* 도장깨기 진행률 */}
      {canTrack && (
        <div className="mb-3 rounded-2xl border border-forest/20 bg-forest-soft/25 p-4">
          <div className="flex items-center justify-between text-sm font-extrabold text-ink">
            <span className="flex items-center gap-1.5">
              <Trophy size={16} className="text-forest" /> 맛집 정복
            </span>
            <span className="tabular-nums text-forest">
              {items.length}곳 중 <b>{visitedCount}곳</b>
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-forest transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {/* 목록/지도 토글 */}
      <div className="mb-3 flex items-center gap-2">
        <div className="flex rounded-full border border-stone-200 bg-white p-0.5">
          <button
            onClick={() => setView("list")}
            className={`flex h-9 items-center gap-1 rounded-full px-3.5 text-[13px] font-bold ${view === "list" ? "bg-forest text-white" : "text-ink-muted"}`}
          >
            <List size={15} /> 목록
          </button>
          <button
            onClick={() => setView("map")}
            className={`flex h-9 items-center gap-1 rounded-full px-3.5 text-[13px] font-bold ${view === "map" ? "bg-forest text-white" : "text-ink-muted"}`}
          >
            <MapIcon size={15} /> 지도
          </button>
        </div>
      </div>

      {/* 지역 탭 */}
      {multiRegion && (
        <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto">
          <RegionChip label="전체" count={items.length} active={region === "전체"} onClick={() => setRegion("전체")} />
          {regionCounts.map((r) => (
            <RegionChip key={r.name} label={r.name} count={r.count} active={region === r.name} onClick={() => setRegion(r.name)} />
          ))}
        </div>
      )}

      {/* 지도 뷰 */}
      {view === "map" && (
        <div className="relative mb-3 h-[320px] overflow-hidden rounded-2xl border border-stone-200 bg-stone-100">
          <div ref={mapBoxRef} className="absolute inset-0" />
          {mapError && (
            <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm font-semibold text-stone-500">
              {mapError}
            </div>
          )}
          {!mapError && geoItems.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm font-semibold text-stone-500">
              이 지역 맛집의 위치 정보가 아직 없어요.
            </div>
          )}
        </div>
      )}

      {/* 목록 */}
      <div className="space-y-3">
        {filtered.map((it, i) => {
          const isVisited = visited.has(it.restaurantId);
          const isSaved = saved.has(it.restaurantId);
          const hasGeo = Number.isFinite(it.latitude) && Number.isFinite(it.longitude);
          return (
            <div key={it.restaurantId} className={`card p-3 ${isVisited ? "border-forest/40 bg-forest-soft/15" : ""}`}>
              <div className="flex items-center gap-3">
                <span className="badge-rank bg-stone-100 text-stone-500">{i + 1}</span>
                <Link href={it.postId ? `/restaurants/${it.postId}` : "#"} className="h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                  {it.media && it.media.type === "image" ? (
                    <CardImage src={it.media.url} alt={it.restaurantName} className="h-14 w-14 object-cover" />
                  ) : (
                    <div className="thumb-empty flex h-14 w-14 items-center justify-center text-forest/40">
                      <Store size={20} strokeWidth={1.7} />
                    </div>
                  )}
                </Link>
                <Link href={it.postId ? `/restaurants/${it.postId}` : "#"} className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-ink">{it.restaurantName}</div>
                  <div className="text-[11px] text-stone-400">
                    {it.regionName}
                    {it.categories.length > 0 && ` · ${it.categories.slice(0, 2).join(", ")}`}
                  </div>
                  {it.shortReview && <p className="mt-0.5 line-clamp-1 text-[13px] text-ink-muted">{it.shortReview}</p>}
                  <div className="mt-1">
                    <VerificationBadges v={it.verification} compact />
                  </div>
                </Link>
              </div>

              {/* 액션 바: 길찾기 / 저장 / 방문 */}
              <div className="mt-3 flex items-center gap-2">
                {hasGeo && (
                  <a
                    href={`https://map.kakao.com/link/to/${encodeURIComponent(it.restaurantName)},${it.latitude},${it.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-9 flex-1 items-center justify-center gap-1 rounded-xl border border-stone-200 text-[13px] font-bold text-ink active:scale-[0.98]"
                  >
                    <Navigation size={14} className="text-forest" /> 길찾기
                  </a>
                )}
                {canTrack && (
                  <>
                    <button
                      onClick={() => toggleSaved(it)}
                      className={`flex h-9 flex-1 items-center justify-center gap-1 rounded-xl border text-[13px] font-bold active:scale-[0.98] ${isSaved ? "border-forest bg-forest-soft text-forest" : "border-stone-200 text-ink"}`}
                    >
                      <Bookmark size={14} className={isSaved ? "fill-forest" : ""} /> {isSaved ? "저장됨" : "저장"}
                    </button>
                    <button
                      onClick={() => toggleVisited(it)}
                      className={`flex h-9 flex-1 items-center justify-center gap-1 rounded-xl border text-[13px] font-bold active:scale-[0.98] ${isVisited ? "border-forest bg-forest text-white" : "border-stone-200 text-ink"}`}
                    >
                      <Check size={14} /> {isVisited ? "가봄" : "방문"}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RegionChip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`h-9 shrink-0 rounded-full border px-3.5 text-[13px] font-bold ${active ? "border-forest bg-forest text-white" : "border-stone-200 bg-white text-ink"}`}
    >
      {label} {count}
    </button>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
