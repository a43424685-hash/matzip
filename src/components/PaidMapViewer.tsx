"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { openExternal } from "@/lib/nativeAuth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { List, Map as MapIcon, Navigation, Bookmark, Check, Store, Trophy, Quote, Pencil, Eye, ChevronDown } from "lucide-react";
import { loadKakaoMaps } from "@/lib/kakaoLoader";
import type { CollectionDetail } from "@/server/collection/CollectionService";
import CardImage from "@/components/CardImage";
import VerificationBadges from "@/components/VerificationBadges";
import { REVEAL_REFUND_THRESHOLD } from "@/lib/iapTiers";

type Item = CollectionDetail["items"][number];

export default function PaidMapViewer({
  collectionId,
  items,
  regionCounts,
  initialVisited,
  initialSaved,
  canTrack,
  isOwner = false,
  revealGating = false,
  previewIds = [],
  initialRevealed = [],
}: {
  collectionId: string;
  items: Item[];
  regionCounts: { name: string; count: number }[];
  initialVisited: string[];
  initialSaved: string[];
  canTrack: boolean;
  isOwner?: boolean;
  // 구매자 블러 게이팅 — 맛보기 외 가게는 '열어보기'로 하나씩 공개(열람 임계치→환불창 소멸)
  revealGating?: boolean;
  previewIds?: string[];
  initialRevealed?: string[];
}) {
  // 모바일 기본값은 '목록' — 무엇을 샀는지(가게들)를 먼저 보여주고, '지도' 탭에서 분포 확인
  const [view, setView] = useState<"map" | "list">("list");
  const [region, setRegion] = useState<string>("전체");
  const [visited, setVisited] = useState<Set<string>>(new Set(initialVisited));
  const [saved, setSaved] = useState<Set<string>>(new Set(initialSaved));
  // 맛보기 + 이미 열람한 가게는 공개 상태로 시작
  const [revealed, setRevealed] = useState<Set<string>>(
    () => new Set([...previewIds, ...initialRevealed]),
  );
  // 맛보기 제외 실제 열람 수 (환불창 판정용)
  const revealCount = useMemo(
    () => [...revealed].filter((id) => !previewIds.includes(id)).length,
    [revealed, previewIds],
  );

  async function reveal(it: Item) {
    if (revealed.has(it.restaurantId)) return;
    setRevealed((s) => new Set(s).add(it.restaurantId));
    try {
      await fetch("/api/collections/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collectionId, restaurantId: it.restaurantId }),
      });
    } catch {
      /* 낙관적 — 실패해도 화면은 유지 */
    }
  }

  const mapBoxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRefs = useRef<any[]>([]);
  const [mapError, setMapError] = useState<string | null>(null);
  // 길찾기 지도 선택창 대상 (누른 맛집)
  const [navTarget, setNavTarget] = useState<{ name: string; lat: number; lng: number } | null>(null);

  const multiRegion = regionCounts.length > 1;
  const filtered = useMemo(
    () => (region === "전체" ? items : items.filter((i) => i.regionName === region)),
    [items, region]
  );
  // 번호 원본 하나만 사용 — 좌표 없는 가게가 껴도 지도 핀 번호와 목록 번호가 항상 일치.
  const indexedItems = useMemo(
    () => filtered.map((item, index) => ({ item, number: index + 1 })),
    [filtered]
  );
  const geoItems = useMemo(
    () => indexedItems.filter(({ item }) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude)),
    [indexedItems]
  );

  useEffect(() => {
    if (view !== "map" || mapRef.current) return;
    let cancelled = false;
    loadKakaoMaps()
      .then(() => {
        if (cancelled || !mapBoxRef.current) return;
        const kakao = window.kakao;
        const first = geoItems[0]?.item;
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

  useEffect(() => {
    if (view === "map" && mapRef.current) {
      // 목록→지도로 돌아오면 컨테이너가 숨겨졌다 다시 보이므로 relayout 필요(안 하면 회색 빈 지도)
      mapRef.current.relayout();
      plotMarkers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoItems, view, visited, revealed]);

  const router = useRouter();
  // 지도 핀 클릭 처리 (카카오 오버레이 안 링크는 SPA 이동이 안 돼서 문서 클릭으로 처리)
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement)?.closest?.(".pm-pin") as HTMLElement | null;
      if (!el) return;
      const rid = el.getAttribute("data-rid");
      const isLocked = el.getAttribute("data-locked") === "1";
      const postid = el.getAttribute("data-postid");
      if (isLocked) {
        const it = items.find((i) => i.restaurantId === rid);
        if (it) void reveal(it);
        return;
      }
      if (postid) router.push(`/restaurants/${postid}`);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  function plotMarkers() {
    const kakao = window.kakao;
    const map = mapRef.current;
    if (!kakao || !map) return;
    markerRefs.current.forEach((m) => m.setMap(null));
    markerRefs.current = [];
    if (geoItems.length === 0) return;

    const bounds = new kakao.maps.LatLngBounds();
    geoItems.forEach(({ item: it, number }) => {
      const pos = new kakao.maps.LatLng(it.latitude, it.longitude);
      bounds.extend(pos);
      const done = visited.has(it.restaurantId);
      // 블러 게이팅 중 아직 안 연 가게: 핀에 이름·상세 링크를 넣지 않는다.
      // (핀 title/링크로 열람 카운트 없이 전체를 소비 → 단순변심 환불하는 우회 차단)
      const locked = revealGating && !revealed.has(it.restaurantId);
      // 라벨 겹침 방지 — 이름 없이 '번호 핀'만. (이름은 목록 탭에서)
      // 핀은 클릭 가능한 요소(.pm-pin) — 카카오 오버레이 안에선 링크가 SPA 이동 안 돼서
      // 문서 클릭 핸들러로 처리(잠김=열어보기, 열림=상세 이동). 터치영역 44px 확보.
      const inner = locked
        ? `width:30px;height:30px;background:#e7e5e4;color:#78716c;border:2px dashed #a8a29e;`
        : `width:30px;height:30px;background:${done ? "#1f4d3f" : "#ffffff"};color:${done ? "#fff" : "#1f2b25"};border:2px solid #1f4d3f;`;
      const overlay = new kakao.maps.CustomOverlay({
        position: pos,
        yAnchor: 1,
        content: `<div class="pm-pin" data-rid="${it.restaurantId}" data-postid="${it.postId ?? ""}" data-locked="${locked ? "1" : "0"}" title="${escapeHtml(it.restaurantName)}" style="cursor:pointer;display:flex;align-items:center;justify-content:center;width:44px;height:44px;"><div style="display:flex;align-items:center;justify-content:center;border-radius:999px;font-size:13px;font-weight:900;box-shadow:0 3px 8px rgba(0,0,0,.25);${inner}">${locked ? "?" : number}</div></div>`,
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
  const allDone = items.length > 0 && visitedCount === items.length;

  return (
    <div className="mt-5">
      {/* 도장깨기 진행률 — 한 줄로 축소 (화면 독점 방지) */}
      {canTrack && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2">
          <Trophy size={14} className={allDone ? "text-coral-dark" : "text-forest"} />
          <span className="shrink-0 text-[12px] font-bold text-ink">맛집 정복</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-100">
            <div
              className={`h-full rounded-full transition-all ${allDone ? "bg-coral" : "bg-forest"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="shrink-0 tabular-nums text-[12px] font-bold text-forest">
            {visitedCount}/{items.length}
          </span>
        </div>
      )}

      {/* 목록 | 지도 세그먼트 (탭) */}
      <div className="mb-3 flex items-center gap-2">
        <div role="tablist" aria-label="보기 방식" className="flex rounded-full border border-stone-200 bg-white p-0.5">
          <button
            role="tab"
            aria-selected={view === "list"}
            onClick={() => setView("list")}
            className={`flex h-9 items-center gap-1 rounded-full px-3.5 text-[13px] font-bold ${view === "list" ? "bg-forest text-white" : "text-ink-muted"}`}
          >
            <List size={15} /> 목록
          </button>
          <button
            role="tab"
            aria-selected={view === "map"}
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

      {/* 지도 뷰 — 목록으로 갔다 와도 깨지지 않게 항상 마운트하고 보일 때만 표시 */}
      <div
        className={`relative mb-3 h-[300px] overflow-hidden rounded-2xl border border-stone-200 bg-stone-100 ${
          view === "map" ? "" : "hidden"
        }`}
      >
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

      {/* 구매자 열람/환불 안내 — 접기 영역(환불 제한 도달 시에만 펼침 강조) */}
      {revealGating && (
        <details
          className={`group mb-3 rounded-xl border text-[12px] ${
            revealCount >= REVEAL_REFUND_THRESHOLD ? "border-amber-200 bg-amber-50" : "border-stone-200 bg-white"
          }`}
          {...(revealCount >= REVEAL_REFUND_THRESHOLD ? { open: true } : {})}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 font-semibold text-ink-muted">
            <span>
              열람·환불 안내 · 열람 {revealCount}/{REVEAL_REFUND_THRESHOLD}
            </span>
            <ChevronDown size={14} className="transition group-open:rotate-180" />
          </summary>
          <div className="border-t border-stone-100 px-3 py-2 leading-relaxed text-ink-muted">
            맛보기 외 가게는 <b>열어보기</b>로 하나씩 공개돼요.{" "}
            {revealCount < REVEAL_REFUND_THRESHOLD ? (
              <>지금은 <b>환불 가능</b> — 맛보기 외 {REVEAL_REFUND_THRESHOLD}곳을 열면 단순 변심 환불이 제한돼요. (콘텐츠 하자·결제 오류는 예외)</>
            ) : (
              <>충분히 열람해 <b>단순 변심 환불이 제한</b>돼요. (콘텐츠 하자·결제 오류는 환불)</>
            )}
          </div>
        </details>
      )}

      {/* 목록 — '목록' 탭에서만 (지도 탭에선 지도만, 중복 렌더 X). 핀 번호와 목록 번호 일치 */}
      {view === "list" && (
        <div className="space-y-3">
        {indexedItems.map(({ item: it, number }) => {
          const isVisited = visited.has(it.restaurantId);
          const isSaved = saved.has(it.restaurantId);
          const hasGeo = Number.isFinite(it.latitude) && Number.isFinite(it.longitude);
          // 구매자 블러 게이팅 — 아직 안 연 가게는 흐릿하게 + '열어보기'
          if (revealGating && !revealed.has(it.restaurantId)) {
            return (
              <button
                key={it.restaurantId}
                onClick={() => reveal(it)}
                className="card relative flex w-full items-center gap-3 overflow-hidden p-3 text-left active:scale-[0.99]"
              >
                <span className="badge-rank bg-stone-100 text-stone-500">{number}</span>
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-stone-200">
                  {it.media && it.media.type === "image" ? (
                    <CardImage src={it.media.thumbnailUrl ?? it.media.url} alt="" className="h-14 w-14 scale-110 object-cover blur-[6px]" />
                  ) : (
                    <div className="thumb-empty flex h-14 w-14 items-center justify-center text-forest/40">
                      <Store size={20} strokeWidth={1.7} />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="h-3.5 w-2/3 rounded bg-stone-200" />
                  <div className="mt-1.5 h-3 w-1/3 rounded bg-stone-100" />
                </div>
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-forest px-3 py-1.5 text-[12px] font-bold text-white">
                  <Eye size={13} /> 열어보기
                </span>
              </button>
            );
          }
          return (
            <div key={it.restaurantId} className={`card p-3 ${isVisited ? "border-forest/40 bg-forest-soft/15" : ""}`}>
              <div className="flex items-center gap-3">
                <span className="badge-rank bg-stone-100 text-stone-500">{number}</span>
                <Link href={it.postId ? `/restaurants/${it.postId}` : "#"} className="h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                  {it.media && it.media.type === "image" ? (
                    <CardImage src={it.media.thumbnailUrl ?? it.media.url} alt={it.restaurantName} className="h-14 w-14 object-cover" />
                  ) : (
                    <div className="thumb-empty flex h-14 w-14 items-center justify-center text-forest/40">
                      <Store size={20} strokeWidth={1.7} />
                    </div>
                  )}
                </Link>
                <Link href={it.postId ? `/restaurants/${it.postId}` : "#"} className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-ink">{it.restaurantName}</div>
                  <div className="text-[12px] text-ink-muted">
                    {it.regionName}
                    {it.categories.length > 0 && ` · ${it.categories.slice(0, 2).join(", ")}`}
                  </div>
                  {!hasGeo && (
                    <div className="mt-1 inline-flex items-center rounded bg-stone-100 px-1.5 py-0.5 text-[11px] font-semibold text-stone-500">
                      지도 위치 없음
                    </div>
                  )}
                  <div className="mt-1">
                    <VerificationBadges v={it.verification} compact />
                  </div>
                </Link>
              </div>

              {/* 큐레이터 추천 이유 (큐레이터 한 줄) */}
              <CuratorNote
                collectionId={collectionId}
                restaurantId={it.restaurantId}
                note={it.note}
                fallback={it.shortReview}
                editable={isOwner}
              />

              {/* 액션 바: 길찾기 / 저장 / 방문 */}
              <div className="mt-3 flex items-center gap-2">
                {hasGeo && (
                  <button
                    type="button"
                    onClick={() => setNavTarget({ name: it.restaurantName, lat: it.latitude as number, lng: it.longitude as number })}
                    className="flex h-9 flex-1 items-center justify-center gap-1 rounded-xl border border-stone-200 text-[13px] font-bold text-ink active:scale-[0.98]"
                  >
                    <Navigation size={14} className="text-forest" /> 길찾기
                  </button>
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
                      <Check size={14} /> {isVisited ? "방문 완료" : "가봤어요"}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        </div>
      )}

      {/* 길찾기 지도 선택창 (카카오·네이버·애플·구글) */}
      {navTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setNavTarget(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-md rounded-t-3xl bg-white p-5 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
            <div className="mb-3 text-center text-sm font-extrabold text-ink">
              <span className="text-forest">{navTarget.name}</span> 길찾기
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { openExternal(`https://map.kakao.com/link/to/${encodeURIComponent(navTarget.name)},${navTarget.lat},${navTarget.lng}`); setNavTarget(null); }} className="h-12 rounded-xl bg-[#FEE500] text-sm font-bold text-[#3c1e1e] active:scale-[0.98]">카카오맵</button>
              <button onClick={() => { openExternal(`https://map.naver.com/p/search/${encodeURIComponent(navTarget.name)}`); setNavTarget(null); }} className="h-12 rounded-xl bg-[#03C75A] text-sm font-bold text-white active:scale-[0.98]">네이버지도</button>
              <button onClick={() => { openExternal(`https://maps.apple.com/?daddr=${navTarget.lat},${navTarget.lng}&dirflg=d`); setNavTarget(null); }} className="h-12 rounded-xl border border-stone-200 text-sm font-bold text-ink active:scale-[0.98]">애플 지도</button>
              <button onClick={() => { openExternal(`https://www.google.com/maps/dir/?api=1&destination=${navTarget.lat},${navTarget.lng}`); setNavTarget(null); }} className="h-12 rounded-xl border border-stone-200 text-sm font-bold text-ink active:scale-[0.98]">구글 지도</button>
            </div>
            <button onClick={() => setNavTarget(null)} className="mt-3 h-11 w-full text-sm font-semibold text-stone-400">닫기</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** 큐레이터 추천 이유 — 표시 + (소유자) 인라인 편집 */
function CuratorNote({
  collectionId,
  restaurantId,
  note,
  fallback,
  editable,
}: {
  collectionId: string;
  restaurantId: string;
  note: string | null;
  fallback: string | null;
  editable: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note ?? "");
  const [busy, setBusy] = useState(false);
  const display = note || fallback;

  async function save() {
    setBusy(true);
    await fetch("/api/collections/note", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collectionId, restaurantId, note: text }),
    }).catch(() => {});
    setBusy(false);
    setEditing(false);
    router.refresh();
  }

  if (editing) {
    return (
      <div className="mt-2 flex gap-1.5">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={60}
          autoFocus
          placeholder="이 집을 추천하는 한 줄 (예: 비 오는 날 국물이 진리)"
          className="input h-9 flex-1 !text-[13px]"
        />
        <button onClick={save} disabled={busy} className="btn-primary h-9 px-3 !text-sm">
          저장
        </button>
      </div>
    );
  }

  if (display) {
    return (
      <button
        onClick={() => editable && setEditing(true)}
        className={`mt-2 flex w-full items-start gap-1.5 rounded-xl bg-forest-soft/30 px-3 py-2 text-left ${editable ? "active:scale-[0.99]" : "cursor-default"}`}
      >
        <Quote size={13} className="mt-0.5 shrink-0 text-forest" />
        <span className="flex-1 text-[13px] font-medium leading-snug text-ink">{display}</span>
        {editable && <Pencil size={13} className="mt-0.5 shrink-0 text-stone-400" />}
      </button>
    );
  }

  if (editable) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="mt-2 flex items-center gap-1 text-[12px] font-semibold text-forest"
      >
        <Pencil size={12} /> 추천 이유 한 줄 쓰기
      </button>
    );
  }
  return null;
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
