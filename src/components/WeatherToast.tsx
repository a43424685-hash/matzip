"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, MapPin, Star, ChevronRight } from "lucide-react";
import CardImage from "./CardImage";
import type { PostCard } from "@/server/restaurant/RestaurantService";

type Item = { post: PostCard; distanceMeters: number | null };
type Weather = { condition: string; tempC: number | null; emoji: string; label: string };

const SNOOZE_KEY = "mgp:weather-snooze";
const ONBOARD_KEY = "mgp:onboarded:v1";
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
function distLabel(m: number | null) {
  if (m == null) return null;
  return m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`;
}

/**
 * 날씨 기반 맛집 추천 토스트 (가운데 팝업).
 * 현재 위치 날씨(기상청)에 맞는 맛집 2~3곳을 날씨 애니메이션과 함께 보여준다.
 * 매 접속마다 뜨되 'X'로 닫고, '오늘 하루 안 보기'로 그날은 숨김.
 * 첫 방문 땐 안내 모달(WelcomeOnboarding)이 닫힌 뒤에 뜬다.
 */
export default function WeatherToast() {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(SNOOZE_KEY) === today()) return; // 오늘 안 보기
    } catch {
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    let cancelled = false;
    const fetchAndShow = () => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const res = await fetch(
              `/api/weather-picks?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`
            );
            const d = (await res.json()) as { ok?: boolean; weather?: Weather; items?: Item[] };
            if (!cancelled && d.ok && d.weather && (d.items?.length ?? 0) > 0) {
              setWeather(d.weather);
              setItems((d.items ?? []).slice(0, 3));
              setOpen(true);
              requestAnimationFrame(() => setEntered(true));
            }
          } catch {
            /* 조용히 숨김 */
          }
        },
        () => {},
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
      );
    };

    // 첫 방문(온보딩 전)이면 안내 모달이 닫힌 뒤에 뜬다
    let onboarded: string | null = "1";
    try {
      onboarded = localStorage.getItem(ONBOARD_KEY);
    } catch {
      /* ignore */
    }
    if (onboarded) {
      fetchAndShow();
      return () => {
        cancelled = true;
      };
    }
    const handler = () => fetchAndShow();
    window.addEventListener("mgp:welcome-done", handler, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener("mgp:welcome-done", handler);
    };
  }, []);

  function close() {
    setEntered(false);
    setTimeout(() => setOpen(false), 260);
  }
  function snoozeToday() {
    try {
      localStorage.setItem(SNOOZE_KEY, today());
    } catch {
      /* ignore */
    }
    close();
  }

  if (!open || !weather) return null;

  return (
    <div
      className={`fixed inset-0 z-[80] flex items-center justify-center px-6 transition-opacity duration-300 ${
        entered ? "opacity-100" : "opacity-0"
      }`}
      onClick={close}
    >
      <div className="absolute inset-0 bg-black/45" />
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl transition-all duration-300 ${
          entered ? "translate-y-0 scale-100" : "translate-y-2 scale-95"
        }`}
      >
        <WeatherScene condition={weather.condition} tempC={weather.tempC} />

        <div className="px-5 pt-3.5">
          <p className="text-[17px] font-black leading-snug text-ink">{weather.label}</p>
        </div>

        <div className="mt-3 space-y-2 px-5">
          {items.map(({ post, distanceMeters }) => (
            <MiniRow key={post.id} post={post} d={distanceMeters} onGo={close} />
          ))}
        </div>

        <div className="mt-3.5 px-5 pb-4">
          <Link
            href="/nearby"
            onClick={close}
            className="flex h-11 items-center justify-center gap-1 rounded-xl bg-forest text-sm font-bold text-white active:scale-[0.99]"
          >
            내 주변 맛집 더 보기 <ChevronRight size={16} />
          </Link>
          <button
            onClick={snoozeToday}
            className="mt-2 h-9 w-full text-[13px] font-semibold text-stone-400 active:scale-95"
          >
            오늘 하루 안 보기
          </button>
        </div>

        <button
          onClick={close}
          aria-label="닫기"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur-sm active:scale-90"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

function MiniRow({ post, d, onGo }: { post: PostCard; d: number | null; onGo: () => void }) {
  const img =
    post.media?.thumbnailUrl || (post.media?.type === "image" ? post.media?.url : null) || null;
  const dl = distLabel(d);
  return (
    <Link
      href={`/restaurants/${post.id}`}
      onClick={onGo}
      className="flex items-center gap-2.5 rounded-xl border border-stone-100 p-2 active:bg-stone-50"
    >
      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-stone-100">
        {img ? (
          <CardImage src={img} alt={post.restaurantName} className="h-11 w-11 object-cover" />
        ) : (
          <div className="thumb-empty h-11 w-11" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-bold text-ink">
          {post.signatureMenu ? (
            <>
              <span className="text-forest">{post.signatureMenu}</span> · {post.restaurantName}
            </>
          ) : (
            post.restaurantName
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-stone-400">
          {post.extRating != null && (
            <span className="flex items-center gap-0.5 font-bold text-amber-500">
              <Star size={9} fill="currentColor" strokeWidth={0} /> {post.extRating.toFixed(1)}
            </span>
          )}
          <span className="flex items-center gap-0.5">
            <MapPin size={9} /> {dl ?? post.regionName}
          </span>
        </div>
      </div>
      <ChevronRight size={15} className="shrink-0 text-stone-300" />
    </Link>
  );
}

// ── 날씨 애니메이션 씬 ────────────────────────────────────────
const SCENE_BG: Record<string, string> = {
  storm: "bg-gradient-to-b from-slate-700 to-slate-900",
  rain: "bg-gradient-to-b from-slate-500 to-slate-700",
  snow: "bg-gradient-to-b from-slate-300 to-sky-400",
  hot: "bg-gradient-to-b from-amber-400 to-orange-500",
  humid: "bg-gradient-to-b from-teal-600 to-slate-600",
  cold: "bg-gradient-to-b from-sky-400 to-indigo-500",
  nice: "bg-gradient-to-b from-sky-400 to-sky-300",
};

function WeatherScene({ condition, tempC }: { condition: string; tempC: number | null }) {
  const bg = SCENE_BG[condition] ?? SCENE_BG.nice;
  return (
    <div className={`relative h-32 w-full overflow-hidden ${bg}`}>
      {(condition === "rain" || condition === "storm") && <Rain heavy={condition === "storm"} />}
      {condition === "storm" && <div className="wt-anim pointer-events-none absolute inset-0 bg-white" style={{ animation: "wt-flash 4s infinite" }} />}
      {condition === "snow" && <Snow />}
      {condition === "hot" && <Sun />}
      {condition === "humid" && <Fog />}
      {condition === "cold" && <Frost />}
      {condition === "nice" && <Clouds />}
      {tempC != null && (
        <span className="absolute left-3 top-3 rounded-full bg-black/25 px-2 py-0.5 text-[13px] font-extrabold text-white backdrop-blur-sm">
          {Math.round(tempC)}°
        </span>
      )}
      <style>{SCENE_CSS}</style>
    </div>
  );
}

function Rain({ heavy }: { heavy: boolean }) {
  const n = heavy ? 34 : 22;
  return (
    <div className="pointer-events-none absolute inset-0" style={{ transform: heavy ? "skewX(-16deg)" : "skewX(-8deg)" }}>
      {Array.from({ length: n }).map((_, i) => (
        <span
          key={i}
          className="wt-anim absolute top-0 w-px bg-white/50"
          style={{
            left: `${(i / n) * 100 + (i % 3) * 2}%`,
            height: `${heavy ? 22 : 16}px`,
            animation: `wt-rain ${(heavy ? 0.5 : 0.8) + (i % 5) * 0.08}s linear ${(i % 7) * 0.12}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

function Snow() {
  return (
    <div className="pointer-events-none absolute inset-0">
      {Array.from({ length: 20 }).map((_, i) => {
        const s = 3 + (i % 4);
        return (
          <span
            key={i}
            className="wt-anim absolute top-0 rounded-full bg-white/85"
            style={{
              left: `${(i / 20) * 100}%`,
              width: `${s}px`,
              height: `${s}px`,
              animation: `wt-snow ${3 + (i % 5) * 0.5}s linear ${(i % 6) * 0.4}s infinite`,
            }}
          />
        );
      })}
    </div>
  );
}

function Sun() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute -right-4 -top-4 h-24 w-24">
        <div className="wt-anim absolute inset-0" style={{ animation: "wt-spin 14s linear infinite" }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <span
              key={i}
              className="absolute left-1/2 top-1/2 h-14 w-1 -translate-x-1/2 -translate-y-1/2 bg-yellow-100/50"
              style={{ transform: `translate(-50%,-50%) rotate(${i * 30}deg)` }}
            />
          ))}
        </div>
        <div className="wt-anim absolute inset-4 rounded-full bg-yellow-200" style={{ animation: "wt-pulse 3s ease-in-out infinite" }} />
      </div>
      <div className="wt-anim absolute inset-x-0 bottom-0 h-10 bg-white/10 blur-md" style={{ animation: "wt-shimmer 2.5s ease-in-out infinite" }} />
    </div>
  );
}

function Fog() {
  return (
    <div className="pointer-events-none absolute inset-0">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="wt-anim absolute h-8 w-[140%] rounded-full bg-white/20 blur-lg"
          style={{ top: `${20 + i * 30}%`, animation: `wt-fog ${6 + i * 2}s ease-in-out ${i * 1.2}s infinite alternate` }}
        />
      ))}
    </div>
  );
}

function Frost() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute inset-0 bg-gradient-to-t from-white/25 to-transparent" />
      {Array.from({ length: 14 }).map((_, i) => (
        <span
          key={i}
          className="wt-anim absolute rounded-full bg-white"
          style={{
            left: `${(i * 37) % 100}%`,
            top: `${(i * 53) % 100}%`,
            width: "3px",
            height: "3px",
            animation: `wt-sparkle ${2 + (i % 4)}s ease-in-out ${(i % 5) * 0.3}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

function Clouds() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute right-5 top-4 h-12 w-12 rounded-full bg-yellow-200/80 blur-[2px]" />
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="wt-anim absolute h-6 w-16 rounded-full bg-white/80 blur-[1px]"
          style={{ top: `${25 + i * 22}%`, animation: `wt-cloud ${16 + i * 6}s linear ${i * 3}s infinite` }}
        />
      ))}
    </div>
  );
}

const SCENE_CSS = `
@keyframes wt-rain { 0%{transform:translateY(-140%)} 100%{transform:translateY(420%)} }
@keyframes wt-snow { 0%{transform:translateY(-140%) translateX(0)} 100%{transform:translateY(460%) translateX(14px)} }
@keyframes wt-spin { to{transform:rotate(360deg)} }
@keyframes wt-pulse { 0%,100%{opacity:.75;transform:scale(1)} 50%{opacity:1;transform:scale(1.08)} }
@keyframes wt-shimmer { 0%,100%{opacity:.15;transform:translateY(0)} 50%{opacity:.35;transform:translateY(-3px)} }
@keyframes wt-fog { 0%{transform:translateX(-25%)} 100%{transform:translateX(15%)} }
@keyframes wt-cloud { 0%{transform:translateX(-30%)} 100%{transform:translateX(220%)} }
@keyframes wt-flash { 0%,88%,100%{opacity:0} 90%,94%{opacity:0} 92%{opacity:.65} 96%{opacity:.4} }
@keyframes wt-sparkle { 0%,100%{opacity:.2} 50%{opacity:.95} }
@media (prefers-reduced-motion: reduce){ .wt-anim{animation:none!important} }
`;
