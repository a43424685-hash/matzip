"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadKakaoMaps } from "@/lib/kakaoLoader";

type Pin = { postId: string; name: string; lat: number; lng: number };

/** 내가 등록한 맛집을 카카오 지도에 핀으로 표시. 핀 클릭 시 해당 맛집으로 이동. */
export default function MyRestaurantsMap({ pins }: { pins: Pin[] }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!boxRef.current || pins.length === 0) return;
    let cancelled = false;
    loadKakaoMaps()
      .then(() => {
        if (cancelled || !boxRef.current) return;
        const kakao = window.kakao;
        const avgLat = pins.reduce((a, p) => a + p.lat, 0) / pins.length;
        const avgLng = pins.reduce((a, p) => a + p.lng, 0) / pins.length;
        const map = new kakao.maps.Map(boxRef.current, {
          center: new kakao.maps.LatLng(avgLat, avgLng),
          level: 8,
        });
        const bounds = new kakao.maps.LatLngBounds();
        for (const p of pins) {
          const pos = new kakao.maps.LatLng(p.lat, p.lng);
          bounds.extend(pos);
          const marker = new kakao.maps.Marker({ position: pos, map, title: p.name });
          kakao.maps.event.addListener(marker, "click", () => router.push(`/restaurants/${p.postId}`));
        }
        if (pins.length > 1) map.setBounds(bounds);
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [pins, router]);

  if (failed) {
    return <div className="flex h-[420px] items-center justify-center text-sm text-stone-400">지도를 불러오지 못했어요.</div>;
  }
  return <div ref={boxRef} className="h-[420px] w-full bg-stone-100" />;
}
