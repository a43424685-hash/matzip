"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Bookmark, ChevronDown, LocateFixed, Play, Search, ShieldCheck, Star } from "lucide-react";
import { loadKakaoMaps } from "@/lib/kakaoLoader";
import type { PostCard as PostCardData } from "@/server/restaurant/RestaurantService";
import CardImage from "@/components/CardImage";

type LatLng = { lat: number; lng: number };
type SheetState = "collapsed" | "default" | "expanded";
type FilterMode = "all" | "saved" | "verified";

type NearbyItem = {
  post: PostCardData;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  liked: boolean;
  saved: boolean;
};

const SEOUL_CENTER: LatLng = { lat: 37.5665, lng: 126.978 };
const LAST_LOCATION_KEY = "mukgopin:lastLocation";
const CATEGORY_LABELS = ["전체", "노포", "야장", "가성비", "데이트", "혼밥", "카페", "술집"];

function formatDistance(m: number) {
  if (m < 1000) return `${m}m`;
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)}km`;
}

// 카카오 지도 줌 레벨(작을수록 확대) → 검색 반경(m). 확대하면 좁게, 축소하면 넓게.
function radiusForLevel(level: number): number {
  const table: Record<number, number> = {
    1: 400, 2: 700, 3: 1200, 4: 2000, 5: 3000, 6: 5000, 7: 8000, 8: 13000,
  };
  return table[level] ?? (level >= 9 ? 20000 : 3000);
}

// 지도에 "보이는 영역 전체"를 덮는 반경(중심→모서리 거리, m). 보이는 맛집이 빠지지 않게.
function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function sheetClass(state: SheetState) {
  if (state === "collapsed") return "h-[14dvh]";
  if (state === "expanded") return "h-[calc(100dvh-98px)]";
  return "h-[28dvh]";
}

export default function NearbyMapScreen() {
  const mapBoxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRefs = useRef<any[]>([]);
  const userMarkerRef = useRef<any>(null);
  const autoSearchTimer = useRef<number | undefined>(undefined);
  const watchIdRef = useRef<number | null>(null);
  const dragStartY = useRef<number | null>(null);

  const [center, setCenter] = useState<LatLng>(SEOUL_CENTER);
  const [userLoc, setUserLoc] = useState<LatLng | null>(null);
  const [items, setItems] = useState<NearbyItem[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetState>("default");
  // 기본은 '전체' — 인증 맛집 + 운영자 PICK(추천) 모두 보여 콘텐츠를 꽉 채운다.
  const [mode, setMode] = useState<FilterMode>("all");
  const [category, setCategory] = useState("전체");
  const [loading, setLoading] = useState(false);
  // 검색(지오코딩→지도 이동) + "이 지역 다시 검색"
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [moved, setMoved] = useState(false);
  const searchParams = useSearchParams();
  const catFilterRef = useRef<string | null>(null); // 검색에서 넘어온 음식 종류 필터(cat)

  // 검색에서 넘어온 경우(/nearby?q=…&cat=…) → 자동으로 그 위치로 지도 이동 + 음식 필터 유지
  useEffect(() => {
    catFilterRef.current = searchParams.get("cat")?.trim() || null;
    const initialQ = searchParams.get("q")?.trim();
    if (initialQ) {
      setQ(initialQ);
      void geocodeAndMove(initialQ);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem(LAST_LOCATION_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as LatLng;
        if (Number.isFinite(parsed.lat) && Number.isFinite(parsed.lng)) setCenter(parsed);
      } catch {
        window.localStorage.removeItem(LAST_LOCATION_KEY);
      }
    }
    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadKakaoMaps()
      .then(() => {
        if (cancelled || !mapBoxRef.current) return;
        const kakao = window.kakao;
        const pos = new kakao.maps.LatLng(center.lat, center.lng);
        const map = new kakao.maps.Map(mapBoxRef.current, {
          center: pos,
          level: 5,
        });
        mapRef.current = map;
        // 지도를 옮기거나 줌하면 그 지역을 "자동으로" 다시 검색한다 (멈춘 뒤 0.45초)
        const onMapMove = () => {
          if (autoSearchTimer.current) window.clearTimeout(autoSearchTimer.current);
          autoSearchTimer.current = window.setTimeout(() => {
            const c = map.getCenter();
            setMoved(false);
            // pan(중심이동)이든 zoom(확대/축소)이든 항상 직접 재검색.
            // 예전엔 setCenter로 처리해서, 줌은 중심이 안 바뀌어 재검색이 아예 안 됐음(버그).
            void loadNearby({ lat: c.getLat(), lng: c.getLng() });
          }, 400);
        };
        kakao.maps.event.addListener(map, "dragend", onMapMove);
        kakao.maps.event.addListener(map, "zoom_changed", onMapMove);
        setMapReady(true);
        // 재진입(다시 들어옴) 시 컨테이너 크기가 늦게 잡혀 지도/마커가 안 그려지는 것 방지
        window.setTimeout(() => {
          if (!cancelled && mapRef.current) {
            mapRef.current.relayout();
            mapRef.current.setCenter(new kakao.maps.LatLng(center.lat, center.lng));
            // 레이아웃(크기) 잡힌 뒤 정확한 화면 범위로 초기 로드 — 처음부터 핀이 뜨게
            void loadNearby({ lat: center.lat, lng: center.lng });
          }
        }, 250);
      })
      .catch((e: Error) => {
        if (!cancelled) setMapError(e.message === "NO_KEY" ? "지도 키가 필요해요." : "지도를 불러오지 못했어요.");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const kakao = window.kakao;
    const map = mapRef.current;
    if (!kakao || !map) return;
    map.setCenter(new kakao.maps.LatLng(center.lat, center.lng));
  }, [center]);

  useEffect(() => {
    const kakao = window.kakao;
    const map = mapRef.current;
    if (!kakao || !map || !userLoc) return;

    const pos = new kakao.maps.LatLng(userLoc.lat, userLoc.lng);
    if (userMarkerRef.current) userMarkerRef.current.setMap(null);
    userMarkerRef.current = new kakao.maps.CustomOverlay({
      position: pos,
      yAnchor: 0.5,
      content: '<div class="nearby-user-marker" aria-label="내 위치"></div>',
      map,
    });
  }, [userLoc]);

  // 지도 준비되면(그리고 중심 바뀌면) 그 즉시 그 지역 맛집 로드 — 처음 진입에도 바로 뜨게.
  useEffect(() => {
    if (!mapReady) return;
    void loadNearby(center);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lng, mapReady]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (mode === "saved" && !item.saved) return false;
      if (mode === "verified" && !item.post.verification.location) return false;
      if (category !== "전체" && !item.post.categories.includes(category)) return false;
      return true;
    });
  }, [items, mode, category]);

  useEffect(() => {
    const kakao = window.kakao;
    const map = mapRef.current;
    if (!kakao || !map || !mapReady) return;

    markerRefs.current.forEach((m) => m.setMap(null));
    markerRefs.current = [];

    filteredItems.slice(0, 30).forEach((item) => {
      const pos = new kakao.maps.LatLng(item.latitude, item.longitude);
      const pick = item.post.isOperatorPick;
      const label = item.saved ? "저장" : pick ? "★PICK" : item.post.verification.location ? "인증" : "맛집";
      const bg = item.saved ? "#1f4d3f" : pick ? "#f59e0b" : "#ffffff";
      const fg = item.saved || pick ? "#ffffff" : "#1f2b25";
      const overlay = new kakao.maps.CustomOverlay({
        position: pos,
        yAnchor: 1.15,
        content: `
          <a href="/restaurants/${item.post.id}" style="
            display:inline-flex;align-items:center;gap:4px;
            padding:6px 10px;border:1px solid rgba(31,61,43,.18);
            border-radius:999px;background:${bg};
            color:${fg};
            font-size:12px;font-weight:800;box-shadow:0 4px 12px rgba(0,0,0,.16);
            white-space:nowrap;text-decoration:none;">
            ${label} · ${formatDistance(item.distanceMeters)}
          </a>`,
        map,
      });
      markerRefs.current.push(overlay);
    });
  }, [filteredItems, mapReady]);

  async function loadNearby(pos: LatLng, radius?: number) {
    setLoading(true);
    try {
      const map = mapRef.current;
      let r = radius;
      if (r == null) {
        const bounds = map?.getBounds?.();
        if (bounds) {
          // 지도에 보이는 영역(중심→북동 모서리) 전체를 덮는 반경 + 여유 10%
          const ne = bounds.getNorthEast();
          r = Math.min(haversineMeters(pos.lat, pos.lng, ne.getLat(), ne.getLng()) * 1.1, 30000);
        } else {
          r = radiusForLevel(map?.getLevel?.() ?? 5);
        }
      }
      const catQ = catFilterRef.current ? `&categoryId=${encodeURIComponent(catFilterRef.current)}` : "";
      const res = await fetch(`/api/nearby?lat=${pos.lat}&lng=${pos.lng}&radius=${Math.round(r)}${catQ}`);
      const data = (await res.json()) as { ok?: boolean; items?: NearbyItem[] };
      setItems(res.ok && data.ok ? data.items ?? [] : []);
    } finally {
      setLoading(false);
    }
  }

  // 검색어 → 좌표(지오코딩) → 지도 이동 후 그 지역 맛집 로드
  // 검색어 → 지도 중심 이동 (setCenter 가 지도 이동 + 그 지역 재검색을 트리거)
  async function geocodeAndMove(query: string) {
    // "맛집/식당/추천/근처" 같은 군더더기 제거 → 위치 정밀도↑ (예: "수유역 5번출구 맛집" → "수유역 5번출구")
    const cleaned = query.replace(/맛집|식당|추천|근처/g, " ").replace(/\s+/g, " ").trim() || query.trim();
    if (!cleaned) return;
    setSearching(true);
    setNotFound(false);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(cleaned)}`);
      const data = (await res.json()) as { ok?: boolean; lat?: number; lng?: number };
      if (data.ok && Number.isFinite(data.lat) && Number.isFinite(data.lng)) {
        setMoved(false);
        // 검색한 지점으로 가깝게 줌인 (동 전체 말고 그 자리) — level 3 ≈ 반경 1km대
        mapRef.current?.setLevel?.(3);
        setCenter({ lat: data.lat as number, lng: data.lng as number });
      } else {
        setNotFound(true);
      }
    } catch {
      setNotFound(true);
    } finally {
      setSearching(false);
    }
  }

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    catFilterRef.current = null; // 검색창에서 직접 검색하면 이전 음식 필터는 해제
    await geocodeAndMove(q.trim());
  }

  // "이 지역 다시 검색" — 현재 지도 중심/줌 기준으로 다시 로드 (줌만 바뀐 경우도 강제 갱신)
  function researchHere() {
    const c = mapRef.current?.getCenter?.();
    if (!c) return;
    const pos = { lat: c.getLat(), lng: c.getLng() };
    setCenter(pos);
    void loadNearby(pos);
    setMoved(false);
  }

  function applyUserLocation(next: LatLng) {
    window.localStorage.setItem(LAST_LOCATION_KEY, JSON.stringify(next));
    setUserLoc(next);
    setCenter(next);
  }

  function locateMe() {
    if (!navigator.geolocation) return;

    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        applyUserLocation(next);
      },
      () => undefined,
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        // 추적 갱신은 '내 위치 마커'만 옮긴다. 지도 중심은 건드리지 않아 드래그가 유지됨.
        // (지도를 내 위치로 다시 맞추려면 '내 위치' 버튼을 누르면 됨)
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        window.localStorage.setItem(LAST_LOCATION_KEY, JSON.stringify(next));
        setUserLoc(next);
      },
      () => undefined,
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 }
    );
  }

  function onTouchStart(e: React.TouchEvent) {
    dragStartY.current = e.touches[0]?.clientY ?? null;
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (dragStartY.current == null) return;
    const endY = e.changedTouches[0]?.clientY ?? dragStartY.current;
    const delta = endY - dragStartY.current;
    dragStartY.current = null;
    if (delta > 45) {
      setSheet((s) => (s === "expanded" ? "default" : "collapsed"));
    } else if (delta < -45) {
      setSheet((s) => (s === "collapsed" ? "default" : "expanded"));
    }
  }

  const savedCount = items.filter((item) => item.saved).length;
  const headerText =
    mode === "saved"
      ? `내 주변 저장 맛집 ${savedCount}곳`
      : mode === "verified"
        ? `주변 인증 맛집 ${filteredItems.length}곳`
        : `주변 맛집 ${filteredItems.length}곳`;

  return (
    <main className="relative h-[calc(100dvh-76px)] overflow-hidden bg-stone-100">
      <div ref={mapBoxRef} className="absolute inset-0" />
      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-stone-100 px-8 text-center text-sm font-semibold text-stone-500">
          {mapError}
        </div>
      )}

      <div className="absolute inset-x-0 top-0 z-20 bg-white/95 pb-3 pt-4 shadow-sm backdrop-blur">
        <div className="flex items-center gap-2 px-4">
          <Link href="/" aria-label="홈으로" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink">
            <ArrowLeft size={25} />
          </Link>
          <form onSubmit={runSearch} className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-full bg-stone-100 px-4">
            <Search size={19} className="shrink-0 text-forest" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="지역·상호명 검색 (예: 수유역, 강릉)"
              className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-ink outline-none placeholder:text-stone-400"
              enterKeyHint="search"
            />
            {searching && <span className="shrink-0 text-xs text-stone-400">검색중</span>}
          </form>
        </div>
        {notFound && (
          <p className="mt-1.5 px-5 text-[12px] text-coral-dark">
            ‘{q.trim()}’ 위치를 못 찾았어요. 동/역/지역명으로 다시 검색해보세요.
          </p>
        )}
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto px-4">
          {CATEGORY_LABELS.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => setCategory(label)}
              className={`h-10 shrink-0 rounded-full border px-4 text-sm font-bold ${
                category === label ? "border-forest bg-forest text-white" : "border-stone-200 bg-white text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {moved && (
        <button
          type="button"
          onClick={researchHere}
          className="absolute left-1/2 top-[128px] z-20 -translate-x-1/2 rounded-full bg-forest px-4 py-2.5 text-sm font-bold text-white shadow-lg active:scale-95"
        >
          이 지역 다시 검색
        </button>
      )}

      <button
        type="button"
        onClick={locateMe}
        className="absolute bottom-[30dvh] left-4 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-white text-ink shadow-lg active:scale-95"
        aria-label="내 위치"
      >
        <LocateFixed size={22} />
      </button>

      <section
        className={`absolute inset-x-0 bottom-0 z-30 rounded-t-[28px] bg-white shadow-[0_-8px_24px_rgba(0,0,0,.12)] transition-[height] duration-200 ${sheetClass(sheet)}`}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <button
          type="button"
          onClick={() => setSheet((s) => (s === "expanded" ? "default" : "expanded"))}
          className="mx-auto flex w-full flex-col items-center pt-2"
          aria-label="목록 펼치기"
        >
          <span className="h-1.5 w-12 rounded-full bg-stone-200" />
        </button>

        <div className="flex items-center justify-between px-5 pt-4">
          <div>
            <div className="text-base font-extrabold text-ink">{headerText}</div>
            <div className="mt-0.5 text-[12px] text-ink-muted">
              {loading ? "불러오는 중" : "가까운 순"}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSheet((s) => (s === "collapsed" ? "default" : "collapsed"))}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-100 text-ink"
            aria-label="목록 접기"
          >
            <ChevronDown size={20} className={sheet === "collapsed" ? "rotate-180" : ""} />
          </button>
        </div>

        <div className="mt-3 flex gap-2 px-5">
          <button
            type="button"
            onClick={() => setMode("all")}
            className={`h-9 rounded-full px-3 text-[13px] font-bold ${
              mode === "all" ? "bg-forest text-white" : "bg-stone-100 text-ink"
            }`}
          >
            전체
          </button>
          <button
            type="button"
            onClick={() => setMode("verified")}
            className={`h-9 rounded-full px-3 text-[13px] font-bold ${
              mode === "verified" ? "bg-forest text-white" : "bg-stone-100 text-ink"
            }`}
          >
            인증 맛집
          </button>
          <button
            type="button"
            onClick={() => setMode("saved")}
            className={`h-9 rounded-full px-3 text-[13px] font-bold ${
              mode === "saved" ? "bg-forest text-white" : "bg-stone-100 text-ink"
            }`}
          >
            저장한 맛집
          </button>
        </div>

        <div className="mt-3 h-[calc(100%-118px)] overflow-y-auto px-5 pb-24">
          {filteredItems.length === 0 ? (
            <div className="rounded-2xl bg-stone-50 px-4 py-8 text-center">
              {mode === "saved" ? (
                <>
                  <p className="text-sm font-bold text-ink">저장한 맛집이 없어요.</p>
                  <p className="mt-1 text-[13px] text-ink-muted">‘인증 맛집’에서 주변 맛집을 둘러보세요.</p>
                  <button
                    type="button"
                    onClick={() => setMode("verified")}
                    className="mt-3 rounded-xl bg-forest px-4 py-2 text-sm font-bold text-white active:scale-95"
                  >
                    인증 맛집 보기
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm font-bold text-ink">주변에 아직 인증 맛집이 없어요.</p>
                  <p className="mt-1 text-[13px] text-ink-muted">현장에서 위치 인증을 하면 여기에 떠요.</p>
                  <Link
                    href="/register"
                    className="mt-3 inline-block rounded-xl bg-forest px-4 py-2 text-sm font-bold text-white active:scale-95"
                  >
                    맛집 등록하기
                  </Link>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredItems.map((item) => (
                <NearbyCard key={item.post.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function NearbyCard({ item }: { item: NearbyItem }) {
  const isVideo = item.post.media?.type === "video";
  const img = item.post.media?.thumbnailUrl || (isVideo ? null : item.post.media?.url) || null;
  return (
    <Link href={`/restaurants/${item.post.id}`} className="flex gap-3 rounded-2xl bg-white py-2 active:scale-[0.99]">
      <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-2xl bg-stone-100">
        {img ? (
          <CardImage src={img} alt={item.post.restaurantName} className="h-full w-full object-cover" />
        ) : isVideo ? (
          <div className="h-full w-full bg-stone-800" />
        ) : (
          <div className="thumb-empty flex h-full w-full items-center justify-center text-[11px] font-bold text-forest">
            먹고핀
          </div>
        )}
        {isVideo && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white">
              <Play size={14} fill="currentColor" />
            </span>
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1 py-1">
        <div className="flex items-center gap-1 text-[12px] font-bold text-forest">
          {item.post.isOperatorPick ? (
            <span className="flex items-center gap-1 text-amber-600">
              <Star size={13} /> 운영자 PICK
            </span>
          ) : item.post.isOfficial ? (
            <span className="flex items-center gap-1 text-amber-600">
              <ShieldCheck size={13} /> 운영자
            </span>
          ) : (
            <>
              {item.saved ? <Bookmark size={13} /> : <ShieldCheck size={13} />}
              {item.saved ? "저장됨" : "인증"}
            </>
          )}
          <span className="text-stone-300">·</span>
          {formatDistance(item.distanceMeters)}
        </div>
        <div className="mt-1 line-clamp-2 text-base font-extrabold leading-tight text-ink">
          {item.post.restaurantName}
        </div>
        <div className="mt-1 text-[13px] text-ink-muted">{item.post.regionName}</div>
        {item.post.shortReview && (
          <div className="mt-1 line-clamp-1 text-[13px] text-ink-muted">{item.post.shortReview}</div>
        )}
        <div className="mt-2 flex gap-1.5">
          {item.post.categories.slice(0, 2).map((c) => (
            <span key={c} className="rounded-md bg-forest-soft px-2 py-0.5 text-[11px] font-bold text-forest">
              {c}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
