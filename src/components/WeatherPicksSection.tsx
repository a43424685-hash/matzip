"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, ShieldCheck, Store, Check } from "lucide-react";
import CardImage from "./CardImage";
import type { PostCard } from "@/server/restaurant/RestaurantService";

type Item = { post: PostCard; distanceMeters: number | null };
type Weather = { condition: string; tempC: number | null; emoji: string; label: string };

function dist(m: number | null) {
  if (m == null) return null;
  return m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`;
}

/**
 * 날씨 기반 맛집 추천 (홈, 추천 탭).
 * GPS로 현재 위치 날씨(기상청)를 조회해 어울리는 카테고리 맛집을 주변 우선으로 보여준다.
 * 위치 거부/데이터 없음/키 미설정이면 조용히 숨긴다(빈 섹션 방지).
 */
export default function WeatherPicksSection() {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `/api/weather-picks?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`
          );
          const data = (await res.json()) as {
            ok?: boolean;
            weather?: Weather;
            items?: Item[];
          };
          if (data.ok && data.weather && (data.items?.length ?? 0) > 0) {
            setWeather(data.weather);
            setItems(data.items ?? []);
            setReady(true);
          }
        } catch {
          /* 조용히 숨김 */
        }
      },
      () => {
        /* 위치 거부 — 섹션 숨김 */
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
    );
  }, []);

  if (!ready || !weather || items.length === 0) return null;

  return (
    <section>
      <div className="px-5 pb-3 pt-9">
        <h2 className="section-title flex items-center gap-1.5">
          <span className="text-[19px] leading-none">{weather.emoji}</span> {weather.label}
        </h2>
        <p className="mt-1 text-[13px] text-ink-muted">
          지금 내 위치 날씨에 어울리는 맛집
          {weather.tempC != null && ` · 현재 ${Math.round(weather.tempC)}°`}
        </p>
      </div>
      <div className="no-scrollbar flex gap-3 overflow-x-auto px-5 pb-1">
        {items.map(({ post, distanceMeters }) => {
          const img =
            post.media?.thumbnailUrl || (post.media?.type === "image" ? post.media?.url : null) || null;
          const d = dist(distanceMeters);
          return (
            <Link
              key={post.id}
              href={`/restaurants/${post.id}`}
              className="flex w-[160px] shrink-0 flex-col rounded-2xl border border-stone-200 bg-white p-2"
            >
              <div className="relative h-[100px] overflow-hidden rounded-xl bg-stone-100">
                {img ? (
                  <CardImage src={img} alt={post.restaurantName} className="h-full w-full object-cover" />
                ) : (
                  <div className="thumb-empty flex h-full w-full items-center justify-center text-forest/40">
                    <Store size={20} />
                  </div>
                )}
                <div className="absolute left-1.5 top-1.5 flex gap-1">
                  {post.isOfficial && (
                    <span className="flex items-center gap-0.5 rounded-full bg-[#1d9bf0] px-1.5 py-0.5 text-[10px] font-bold text-white">
                      <Check size={9} strokeWidth={3.5} /> 운영자
                    </span>
                  )}
                  {post.verification?.location && (
                    <span className="flex items-center gap-0.5 rounded-full bg-forest/90 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      <ShieldCheck size={9} /> 인증
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-1.5 truncate text-sm font-bold text-ink">{post.restaurantName}</div>
              <div className="flex items-center gap-0.5 text-[11px] text-stone-400">
                <MapPin size={10} /> {d ? `${d} · ` : ""}
                {post.regionName}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
