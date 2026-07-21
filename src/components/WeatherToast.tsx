"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, MapPin, Star, ChevronRight } from "lucide-react";
import CardImage from "./CardImage";
import type { PostCard } from "@/server/restaurant/RestaurantService";

type Item = { post: PostCard; distanceMeters: number | null };
type Weather = { condition: string; tempC: number | null; humidity: number | null; emoji: string; label: string };

const SNOOZE_KEY = "mgp:weather-snooze";
const ONBOARD_KEY = "mgp:onboarded:v1";
const CACHE_KEY = "mgp:weather-cache"; // 세션 캐시 — 재방문 시 즉시 표시
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

    let cancelled = false;
    let shown = false;

    // 1) 세션 캐시가 있으면 즉시 표시 (대기 0) — 재방문 빠르게
    try {
      const c = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null");
      if (c && Date.now() - c.ts < 1_800_000 && c.weather && c.items?.length) {
        setWeather(c.weather);
        setItems(c.items);
        setOpen(true);
        requestAnimationFrame(() => setEntered(true));
        shown = true;
      }
    } catch {
      /* ignore */
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    // 2) 항상 최신 날씨를 백그라운드로 받아 갱신 (온도·날씨 바뀌면 조용히 교체)
    const refresh = () => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            // 주변 지도가 '내 주변 더 보기'로 열릴 때 바로 이 위치에서 열리도록 저장
            try {
              localStorage.setItem("mukgopin:lastLocation", JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude, ts: Date.now() }));
            } catch {
              /* ignore */
            }
            const res = await fetch(`/api/weather-picks?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`);
            const d = (await res.json()) as { ok?: boolean; weather?: Weather; items?: Item[] };
            if (cancelled || !d.ok || !d.weather || (d.items?.length ?? 0) === 0) return;
            const items3 = (d.items ?? []).slice(0, 3);
            setWeather(d.weather); // 캐시로 떠 있어도 최신 값으로 교체
            setItems(items3);
            if (!shown) {
              setOpen(true);
              requestAnimationFrame(() => setEntered(true));
              shown = true;
            }
            try {
              sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), weather: d.weather, items: items3 }));
            } catch {
              /* ignore */
            }
          } catch {
            /* 조용히 숨김 */
          }
        },
        () => {},
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
      );
    };

    // 캐시로 이미 떴거나 온보딩 완료면 바로 갱신, 첫 방문이면 안내 모달 닫힌 뒤
    let onboarded: string | null = "1";
    try {
      onboarded = localStorage.getItem(ONBOARD_KEY);
    } catch {
      /* ignore */
    }
    if (shown || onboarded) {
      refresh();
      return () => {
        cancelled = true;
      };
    }
    const handler = () => refresh();
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
    // 홈을 가리지 않는 하단 인라인 카드 (전체화면 딤 제거) — 하단 탭 위에 뜬다
    <div
      className={`fixed inset-x-0 bottom-[88px] z-[70] flex justify-center px-4 transition-all duration-300 ${
        entered ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
      }`}
    >
      <div
        className={`relative w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/5`}
      >
        <WeatherScene condition={weather.condition} tempC={weather.tempC} humidity={weather.humidity} />

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

// ── 날씨 애니메이션 씬 (weather-preview.html 버전) ─────────────
const SCENE_BG: Record<string, string> = {
  storm: "bg-gradient-to-b from-slate-700 to-slate-900",
  rain: "bg-gradient-to-b from-slate-500 to-slate-700",
  snow: "bg-gradient-to-b from-slate-400 to-sky-300",
  hot: "bg-gradient-to-b from-amber-400 to-orange-500",
  humid: "bg-gradient-to-b from-teal-700 to-slate-600",
  cold: "bg-gradient-to-b from-sky-400 to-indigo-600",
  nice: "bg-gradient-to-b from-sky-400 to-sky-300",
};

function WeatherScene({ condition, tempC, humidity }: { condition: string; tempC: number | null; humidity: number | null }) {
  const bg = SCENE_BG[condition] ?? SCENE_BG.nice;
  return (
    <div className={`relative h-32 w-full overflow-hidden ${bg}`}>
      {condition === "nice" && <SceneNice />}
      {condition === "rain" && <SceneRain />}
      {condition === "storm" && <SceneStorm />}
      {condition === "snow" && <SceneSnow />}
      {condition === "hot" && <SceneHot />}
      {condition === "humid" && <SceneHumid />}
      {condition === "cold" && <SceneCold />}
      {tempC != null && (
        <span className="absolute left-3 top-3 z-10 rounded-full bg-black/30 px-2 py-0.5 text-[13px] font-extrabold text-white backdrop-blur-sm">
          {Math.round(tempC)}°{condition === "humid" && humidity != null ? ` · 💧${Math.round(humidity)}%` : ""}
        </span>
      )}
      <style>{SCENE_CSS}</style>
    </div>
  );
}

function SceneNice() {
  const clouds = [
    { top: 70, w: 70, h: 22, dur: "16s", d: "0s" },
    { top: 30, w: 52, h: 18, dur: "22s", d: "3s" },
    { top: 100, w: 44, h: 16, dur: "18s", d: "6s" },
  ];
  return (
    <div className="pointer-events-none absolute inset-0">
      <div
        className="wt-anim absolute right-6 top-4 h-14 w-14 rounded-full"
        style={{ background: "radial-gradient(circle,#fef9c3,#fde047)", boxShadow: "0 0 34px 10px rgba(253,224,71,.55)", animation: "wt-pulse 3s ease-in-out infinite" }}
      />
      {clouds.map((c, i) => (
        <div key={i} className="wt-anim absolute rounded-full bg-white/90 blur-[1px]" style={{ top: c.top, left: -34, width: c.w, height: c.h, animation: `wt-drift ${c.dur} linear ${c.d} infinite` }} />
      ))}
    </div>
  );
}

function SceneRain() {
  return (
    <div className="pointer-events-none absolute inset-0">
      {Array.from({ length: 26 }).map((_, i) => (
        <span key={i} className="wt-anim absolute top-0 w-px" style={{ left: `${(i / 26) * 100 + (i % 3)}%`, height: "18px", background: "linear-gradient(rgba(255,255,255,0),rgba(255,255,255,.7))", animation: `wt-fall ${0.55 + (i % 4) * 0.06}s linear ${(i % 7) * 0.08}s infinite` }} />
      ))}
      {Array.from({ length: 10 }).map((_, i) => (
        <span key={`g${i}`} className="absolute rounded-full bg-white/30" style={{ left: `${(i * 47) % 95}%`, top: `${(i * 31) % 90}%`, width: "5px", height: "9px" }} />
      ))}
    </div>
  );
}

function SceneStorm() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute h-10 w-32 rounded-full bg-slate-800/90 blur-md" style={{ top: -8, left: -20 }} />
      <div className="absolute h-10 w-32 rounded-full bg-slate-800/90 blur-md" style={{ top: -14, right: -30 }} />
      {Array.from({ length: 28 }).map((_, i) => (
        <span key={i} className="wt-anim absolute top-0 w-px" style={{ left: `${(i / 28) * 100 + (i % 3)}%`, height: "24px", background: "linear-gradient(rgba(255,255,255,0),rgba(255,255,255,.6))", animation: `wt-fall-steep ${0.4 + (i % 4) * 0.05}s linear ${(i % 7) * 0.07}s infinite` }} />
      ))}
      <div className="wt-anim absolute inset-0 bg-white" style={{ animation: "wt-flash 3.5s infinite" }} />
      <svg className="wt-anim absolute" style={{ left: "58%", top: 8, width: 34, height: 60, animation: "wt-flash 3.5s infinite" }} viewBox="0 0 40 70">
        <polygon points="22,0 6,38 18,38 12,70 36,26 22,26" fill="#fde047" />
      </svg>
    </div>
  );
}

function SceneSnow() {
  return (
    <div className="pointer-events-none absolute inset-0">
      {Array.from({ length: 22 }).map((_, i) => {
        const s = 3 + (i % 4);
        return <span key={i} className="wt-anim absolute top-0 rounded-full bg-white/90" style={{ left: `${(i / 22) * 100}%`, width: s, height: s, animation: `wt-snow ${3 + (i % 5) * 0.5}s linear ${(i % 6) * 0.4}s infinite` }} />;
      })}
      <div className="absolute inset-x-0 bottom-0 h-4 bg-white/95 blur-[1px]" style={{ borderRadius: "50% 50% 0 0 / 100% 100% 0 0" }} />
    </div>
  );
}

function SceneHot() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute right-5 top-3 h-14 w-14">
        <div className="wt-anim absolute inset-0" style={{ animation: "wt-spin 16s linear infinite" }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <span key={i} className="absolute left-1/2 top-1/2 rounded bg-yellow-100/60" style={{ width: 4, height: 62, transform: `translate(-50%,-50%) rotate(${i * 30}deg)` }} />
          ))}
        </div>
        <div className="wt-anim absolute inset-2.5 rounded-full bg-yellow-200" style={{ boxShadow: "0 0 34px 12px rgba(254,240,138,.65)", animation: "wt-pulse 2.4s ease-in-out infinite" }} />
      </div>
      <div className="wt-anim absolute inset-x-0 bottom-0 h-10" style={{ background: "repeating-linear-gradient(90deg,rgba(255,255,255,.12) 0 8px,transparent 8px 16px)", filter: "blur(3px)", animation: "wt-shimmer 2.5s ease-in-out infinite" }} />
    </div>
  );
}

function SceneHumid() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="wt-anim absolute" style={{ top: 22, left: "-35%", width: "170%", height: 70, background: "rgba(255,255,255,.22)", filter: "blur(16px)", borderRadius: "50%", animation: "wt-fog 7s ease-in-out infinite alternate" }} />
      <div className="wt-anim absolute" style={{ top: 78, left: "-35%", width: "170%", height: 70, background: "rgba(255,255,255,.22)", filter: "blur(16px)", borderRadius: "50%", animation: "wt-fog 7s ease-in-out 2s infinite alternate" }} />
      {Array.from({ length: 7 }).map((_, i) => (
        <span key={i} className="wt-anim wt-rundrop absolute" style={{ left: `${7 + i * 13}%`, top: -16, animation: `wt-rundown ${2.4 + (i % 3) * 0.8}s linear ${(i % 4) * 0.7}s infinite` }} />
      ))}
      {Array.from({ length: 10 }).map((_, i) => (
        <span key={`c${i}`} className="absolute" style={{ left: `${(i * 37) % 92}%`, top: `${(i * 29) % 85}%`, width: 7, height: 11, borderRadius: "50% 50% 55% 55%", background: "rgba(255,255,255,.4)", boxShadow: "inset -1px -2px 2px rgba(255,255,255,.7)" }} />
      ))}
    </div>
  );
}

function SceneCold() {
  const xtals = [
    { c: "❄", left: "5%", top: "8%", fs: 16 },
    { c: "❅", left: "84%", top: "10%", fs: 19 },
    { c: "❆", left: "8%", top: "68%", fs: 22 },
    { c: "✳", left: "80%", top: "64%", fs: 25 },
  ];
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="wt-anim absolute inset-0" style={{ boxShadow: "inset 0 0 46px 16px rgba(255,255,255,.55)", animation: "wt-frost 4s ease-in-out infinite" }} />
      {xtals.map((x, i) => (
        <span key={i} className="wt-anim absolute font-bold text-white/90" style={{ left: x.left, top: x.top, fontSize: x.fs, animation: `wt-twinkle 2.4s ease-in-out ${i * 0.4}s infinite` }}>{x.c}</span>
      ))}
      {Array.from({ length: 12 }).map((_, i) => (
        <span key={`i${i}`} className="wt-anim absolute top-0 rounded-full bg-white" style={{ left: `${(i / 12) * 100}%`, width: 4, height: 4, boxShadow: "0 0 5px #fff", animation: `wt-ice ${4 + (i % 4)}s linear ${(i % 5) * 0.5}s infinite` }} />
      ))}
      <span className="wt-anim absolute rounded-full bg-white/55 blur-md" style={{ left: 20, bottom: 24, width: 34, height: 16, animation: "wt-breath 4.5s ease-in-out infinite" }} />
      <span className="wt-anim absolute rounded-full bg-white/55 blur-md" style={{ left: 58, bottom: 30, width: 34, height: 16, animation: "wt-breath 4.5s ease-in-out 2.2s infinite" }} />
    </div>
  );
}

const SCENE_CSS = `
@keyframes wt-pulse { 0%,100%{transform:scale(1);opacity:.85} 50%{transform:scale(1.08);opacity:1} }
@keyframes wt-drift { from{transform:translateX(0)} to{transform:translateX(420px)} }
@keyframes wt-fall { from{transform:translateY(-40px) skewX(-12deg)} to{transform:translateY(150px) skewX(-12deg)} }
@keyframes wt-fall-steep { from{transform:translateY(-40px) skewX(-26deg)} to{transform:translateY(150px) skewX(-26deg)} }
@keyframes wt-snow { from{transform:translateY(-20px) translateX(0)} to{transform:translateY(150px) translateX(16px)} }
@keyframes wt-spin { to{transform:rotate(360deg)} }
@keyframes wt-shimmer { 0%,100%{opacity:.4;transform:translateY(0)} 50%{opacity:.7;transform:translateY(-3px)} }
@keyframes wt-flash { 0%,90%,100%{opacity:0} 92%{opacity:.75} 94%{opacity:.2} 96%{opacity:.6} }
@keyframes wt-fog { from{transform:translateX(-10%)} to{transform:translateX(10%)} }
@keyframes wt-rundown { 0%{transform:translateY(0);opacity:0} 12%{opacity:1} 100%{transform:translateY(150px);opacity:.85} }
@keyframes wt-frost { 0%,100%{opacity:.65} 50%{opacity:1} }
@keyframes wt-twinkle { 0%,100%{opacity:.2;transform:scale(.85)} 50%{opacity:1;transform:scale(1.1)} }
@keyframes wt-ice { 0%{transform:translateY(0) translateX(0);opacity:0} 12%{opacity:.9} 100%{transform:translateY(150px) translateX(12px);opacity:.35} }
@keyframes wt-breath { 0%{opacity:0;transform:translate(0,0) scale(.7)} 45%{opacity:.6} 100%{opacity:0;transform:translate(16px,-16px) scale(1.25)} }
.wt-rundrop { width:6px;height:11px;border-radius:50% 50% 55% 55%;background:rgba(255,255,255,.72);box-shadow:0 0 5px rgba(255,255,255,.6); }
.wt-rundrop::after { content:'';position:absolute;top:-46px;left:2px;width:2px;height:46px;background:linear-gradient(rgba(255,255,255,0),rgba(255,255,255,.5)); }
@media (prefers-reduced-motion: reduce){ .wt-anim{animation:none!important} }
`;
