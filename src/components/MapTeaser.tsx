"use client";

import { useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import { loadKakaoMaps } from "@/lib/kakaoLoader";

type Pin = { lat: number; lng: number; locked: boolean };

/** 유료 지도 구매 전 티저 — 분포는 보여주되 줌·이동을 막아 정확 위치는 숨긴다. */
export default function MapTeaser({ pins }: { pins: Pin[] }) {
  const boxRef = useRef<HTMLDivElement>(null);
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
          level: 6, // 동네 단위 — 골목까지 못 보게 고정
        });
        map.setZoomable(false);
        map.setDraggable(false);
        for (const p of pins) {
          new kakao.maps.Marker({ position: new kakao.maps.LatLng(p.lat, p.lng), map });
        }
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [pins]);

  if (pins.length === 0 || failed) return null;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-stone-200">
      <div ref={boxRef} className="h-44 w-full bg-stone-100" />
      <div className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-ink/80 px-2.5 py-1 text-[11px] font-bold text-white">
        <Lock size={11} /> 정확한 위치는 구매 후 공개
      </div>
    </div>
  );
}
