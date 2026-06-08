"use client";

import { useState } from "react";
import { LocateFixed, MapPin } from "lucide-react";
import PostCard from "@/components/PostCard";
import type { PostCard as PostCardData } from "@/server/restaurant/RestaurantService";

type NearbyItem = {
  post: PostCardData;
  distanceMeters: number;
  liked: boolean;
  saved: boolean;
};

function formatDistance(m: number) {
  if (m < 1000) return `${m}m`;
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)}km`;
}

export default function NearbyFinder() {
  const [items, setItems] = useState<NearbyItem[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("현재 위치를 켜면 주변 인증 맛집을 거리순으로 보여줘요.");

  async function loadNearby() {
    if (!navigator.geolocation) {
      setMessage("이 브라우저에서는 위치 기능을 사용할 수 없어요.");
      return;
    }

    setLoading(true);
    setMessage("현재 위치를 확인하는 중이에요.");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(`/api/nearby?lat=${latitude}&lng=${longitude}`);
          const data = (await res.json()) as {
            ok?: boolean;
            error?: string;
            items?: NearbyItem[];
            isLoggedIn?: boolean;
          };
          if (!res.ok || !data.ok) {
            setMessage(data.error ?? "주변 맛집을 불러오지 못했어요.");
            return;
          }
          setItems(data.items ?? []);
          setIsLoggedIn(!!data.isLoggedIn);
          setMessage(
            data.items?.length
              ? "가까운 인증 맛집부터 정렬했어요."
              : "주변에 위치 인증된 맛집이 아직 없어요."
          );
        } catch {
          setMessage("주변 맛집을 불러오지 못했어요.");
        } finally {
          setLoading(false);
        }
      },
      () => {
        setLoading(false);
        setMessage("위치 권한을 허용해야 주변 맛집을 볼 수 있어요.");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  }

  return (
    <section>
      <div className="rounded-3xl bg-forest px-5 py-6 text-white">
        <LocateFixed size={27} />
        <h2 className="mt-3 text-2xl font-extrabold">내 주변 맛집</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/80">
          GPS 기준으로 가까운 위치 인증 맛집을 먼저 보여줍니다.
        </p>
        <button
          type="button"
          onClick={loadNearby}
          disabled={loading}
          className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white text-sm font-extrabold text-forest active:scale-[0.99] disabled:opacity-60"
        >
          <MapPin size={18} />
          {loading ? "찾는 중..." : "현재 위치로 찾기"}
        </button>
      </div>

      <p className="mt-4 text-[13px] text-ink-muted">{message}</p>

      {items.length > 0 && (
        <div className="mt-4 space-y-4">
          {items.map((item) => (
            <div key={item.post.id}>
              <div className="mb-1.5 px-1 text-xs font-bold text-forest">
                현재 위치에서 {formatDistance(item.distanceMeters)}
              </div>
              <PostCard
                post={item.post}
                liked={item.liked}
                saved={item.saved}
                isLoggedIn={isLoggedIn}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
