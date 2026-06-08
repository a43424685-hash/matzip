"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bookmark, ChevronDown, LocateFixed, Search, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { loadKakaoMaps } from "@/lib/kakaoLoader";
import type { PostCard as PostCardData } from "@/server/restaurant/RestaurantService";
import CardImage from "@/components/CardImage";

type LatLng = { lat: number; lng: number };
type SheetState = "collapsed" | "default" | "expanded";
type FilterMode = "saved" | "verified";

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

function sheetClass(state: SheetState) {
  if (state === "collapsed") return "h-[14dvh]";
  if (state === "expanded") return "h-[calc(100dvh-98px)]";
  return "h-[28dvh]";
}

export default function NearbyMapScreen() {
  const mapBoxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRefs = useRef<any[]>([]);
  const dragStartY = useRef<number | null>(null);

  const [center, setCenter] = useState<LatLng>(SEOUL_CENTER);
  const [items, setItems] = useState<NearbyItem[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetState>("default");
  const [mode, setMode] = useState<FilterMode>("saved");
  const [category, setCategory] = useState("전체");
  const [loading, setLoading] = useState(false);

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
        setMapReady(true);
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
    void loadNearby(center);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lng]);

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
      const label = item.saved ? "저장" : "인증";
      const overlay = new kakao.maps.CustomOverlay({
        position: pos,
        yAnchor: 1.15,
        content: `
          <a href="/restaurants/${item.post.id}" style="
            display:inline-flex;align-items:center;gap:4px;
            padding:6px 10px;border:1px solid rgba(31,61,43,.18);
            border-radius:999px;background:${item.saved ? "#1f4d3f" : "#ffffff"};
            color:${item.saved ? "#ffffff" : "#1f2b25"};
            font-size:12px;font-weight:800;box-shadow:0 4px 12px rgba(0,0,0,.16);
            white-space:nowrap;text-decoration:none;">
            ${label} · ${formatDistance(item.distanceMeters)}
          </a>`,
        map,
      });
      markerRefs.current.push(overlay);
    });
  }, [filteredItems, mapReady]);

  async function loadNearby(pos: LatLng) {
    setLoading(true);
    try {
      const res = await fetch(`/api/nearby?lat=${pos.lat}&lng=${pos.lng}`);
      const data = (await res.json()) as { ok?: boolean; items?: NearbyItem[] };
      setItems(res.ok && data.ok ? data.items ?? [] : []);
    } finally {
      setLoading(false);
    }
  }

  function locateMe() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        window.localStorage.setItem(LAST_LOCATION_KEY, JSON.stringify(next));
        setCenter(next);
      },
      () => undefined,
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
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
  const headerText = mode === "saved" ? `내 주변 저장 맛집 ${savedCount}곳` : `주변 인증 맛집 ${filteredItems.length}곳`;

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
          <Link href="/search" className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-full bg-stone-100 px-4 text-[15px] font-semibold text-stone-400">
            <Search size={19} className="text-forest" />
            지역·상호명 검색
          </Link>
        </div>
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto px-4">
          <button className="flex h-10 shrink-0 items-center gap-1 rounded-full border border-stone-200 bg-white px-3 text-sm font-bold text-ink">
            <SlidersHorizontal size={17} /> 유형
          </button>
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
              {loading ? "불러오는 중" : "거리순으로 가까운 곳부터"}
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
            onClick={() => setMode("saved")}
            className={`h-9 rounded-full px-3 text-[13px] font-bold ${
              mode === "saved" ? "bg-forest text-white" : "bg-stone-100 text-ink"
            }`}
          >
            저장한 맛집
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
        </div>

        <div className="mt-3 h-[calc(100%-118px)] overflow-y-auto px-5 pb-24">
          {filteredItems.length === 0 ? (
            <div className="rounded-2xl bg-stone-50 px-4 py-8 text-center">
              <p className="text-sm font-bold text-ink">표시할 맛집이 없어요.</p>
              <p className="mt-1 text-[13px] text-ink-muted">저장한 맛집이 없으면 인증 맛집 탭을 눌러보세요.</p>
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
  const img = item.post.media?.thumbnailUrl || item.post.media?.url || null;
  return (
    <Link href={`/restaurants/${item.post.id}`} className="flex gap-3 rounded-2xl bg-white py-2 active:scale-[0.99]">
      <div className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl bg-stone-100">
        {img ? (
          <CardImage src={img} alt={item.post.restaurantName} className="h-full w-full object-cover" />
        ) : (
          <div className="thumb-empty flex h-full w-full items-center justify-center text-[11px] font-bold text-forest">
            먹고핀
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 py-1">
        <div className="flex items-center gap-1 text-[12px] font-bold text-forest">
          {item.saved ? <Bookmark size={13} /> : <ShieldCheck size={13} />}
          {item.saved ? "저장됨" : "인증"}
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
