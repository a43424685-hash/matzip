"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, ChevronRight, ShieldCheck, Store, LocateFixed, Check } from "lucide-react";
import CardImage from "./CardImage";
import type { PostCard } from "@/server/restaurant/RestaurantService";

type NearbyItem = { post: PostCard; distanceMeters: number };

function dist(m: number) {
  return m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`;
}

export default function NearbyHomeSection() {
  const [state, setState] = useState<"loading" | "granted" | "denied">("loading");
  const [items, setItems] = useState<NearbyItem[]>([]);
  // 위치 권한을 "영구 거부"한 경우 — 버튼을 눌러도 안 떠서, 설정 안내가 따로 필요
  const [permBlocked, setPermBlocked] = useState(false);

  function locate() {
    setState("loading");
    if (!navigator.geolocation) {
      setState("denied");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          // '더보기'로 주변 지도 열 때 바로 내 위치에서 열리도록 저장
          try {
            localStorage.setItem("mukgopin:lastLocation", JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude, ts: Date.now() }));
          } catch {
            /* ignore */
          }
          const res = await fetch(`/api/nearby?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`);
          const data = (await res.json()) as { ok?: boolean; items?: NearbyItem[] };
          setItems(data.items ?? []);
          setState("granted");
        } catch {
          setState("denied");
        }
      },
      (err) => {
        // 사용자가 위치 권한을 거부(특히 영구 거부)한 경우
        if (err.code === err.PERMISSION_DENIED) setPermBlocked(true);
        setState("denied");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  useEffect(() => {
    locate();
  }, []);

  return (
    <section>
      <div className="flex items-end justify-between px-5 pb-3 pt-9">
        <div>
          <h2 className="section-title">내 주변 인증 맛집</h2>
          <p className="mt-1 text-[13px] text-ink-muted">GPS 기준 3km 이내 인증 맛집만</p>
        </div>
        <Link href="/nearby" className="flex items-center text-[13px] font-semibold text-forest">
          더보기 <ChevronRight size={15} />
        </Link>
      </div>

      {state === "denied" ? (
        <div className="relative mx-5 overflow-hidden rounded-2xl border border-stone-200">
          <div className="no-scrollbar flex gap-3 p-3 blur-[5px]">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[150px] w-[160px] shrink-0 rounded-2xl bg-stone-100">
                <div className="h-[96px] rounded-t-2xl bg-stone-200" />
                <div className="space-y-1.5 p-2.5">
                  <div className="h-3 w-3/4 rounded bg-stone-200" />
                  <div className="h-2.5 w-1/2 rounded bg-stone-100" />
                </div>
              </div>
            ))}
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/55 px-6 text-center">
            {permBlocked ? (
              <>
                <p className="text-[13px] font-bold text-ink">위치 권한이 꺼져 있어요</p>
                <p className="text-[12px] leading-snug text-ink-muted">
                  주소창의 자물쇠(또는 휴대폰 설정 → 권한)에서 <b className="text-ink">위치 허용</b>으로 바꾼 뒤 새로고침해주세요.
                </p>
                <button
                  onClick={locate}
                  className="mt-1 flex items-center gap-1.5 rounded-full bg-stone-200 px-3.5 py-1.5 text-[13px] font-bold text-ink active:scale-95"
                >
                  <LocateFixed size={14} /> 다시 시도
                </button>
              </>
            ) : (
              <>
                <p className="text-[13px] font-bold text-ink">위치를 켜면 내 주변 맛집을 추천해드려요</p>
                <button
                  onClick={locate}
                  className="flex items-center gap-1.5 rounded-full bg-forest px-3.5 py-1.5 text-[13px] font-bold text-white active:scale-95"
                >
                  <LocateFixed size={14} /> 위치 켜기
                </button>
              </>
            )}
          </div>
        </div>
      ) : state === "loading" ? (
        <div className="no-scrollbar flex gap-3 overflow-x-auto px-5 pb-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[150px] w-[160px] shrink-0 animate-pulse rounded-2xl bg-stone-100" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="mx-5 rounded-2xl bg-stone-50 py-6 text-center text-sm text-stone-400">
          3km 안에 인증 맛집이 아직 없어요.
        </p>
      ) : (
        <div className="no-scrollbar flex gap-3 overflow-x-auto px-5 pb-1">
          {items.map(({ post, distanceMeters }) => {
            const img = post.media?.thumbnailUrl || (post.media?.type === "image" ? post.media?.url : null) || null;
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
                      <span className="flex items-center gap-0.5 rounded-full bg-ink px-1.5 py-0.5 text-[10px] font-bold text-white">
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
                  <MapPin size={10} /> {dist(distanceMeters)} · {post.regionName}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
