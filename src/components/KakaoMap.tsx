"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { loadKakaoMaps } from "@/lib/kakaoLoader";

interface LatLng {
  lat: number;
  lng: number;
}

// HTML 인젝션 방지 — 오버레이 content 에 넣기 전 가게명 이스케이프 (XSS 차단)
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface KakaoMapProps {
  /** 가게(권위 좌표) 위치 */
  center: LatLng;
  /** 가게 이름 — 핀 위 라벨 */
  name?: string;
  /** 사용자의 현재 위치 (위치 인증 시 표시) */
  userLoc?: LatLng | null;
  /** 인증 반경(m) — 가게 주변에 원으로 표시 */
  thresholdMeters?: number;
  /** 지도 높이(px) */
  height?: number;
  className?: string;
}

export default function KakaoMap({
  center,
  name,
  userLoc = null,
  thresholdMeters,
  height = 200,
  className = "",
}: KakaoMapProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const [error, setError] = useState<"NO_KEY" | "FAILED" | null>(null);

  // 지도 생성 (가게 핀 + 인증 반경 원) — center 가 바뀔 때만
  useEffect(() => {
    let cancelled = false;
    loadKakaoMaps()
      .then(() => {
        if (cancelled || !boxRef.current) return;
        const kakao = window.kakao;
        const pos = new kakao.maps.LatLng(center.lat, center.lng);
        const map = new kakao.maps.Map(boxRef.current, { center: pos, level: 3 });
        mapRef.current = map;

        // 가게 마커
        const marker = new kakao.maps.Marker({ position: pos });
        marker.setMap(map);
        if (name) {
          new kakao.maps.CustomOverlay({
            position: pos,
            yAnchor: 2.1,
            content: `<div style="padding:3px 8px;background:#1f3d2b;color:#fff;border-radius:8px;font-size:11px;font-weight:700;white-space:nowrap;">${escapeHtml(name)}</div>`,
            map,
          });
        }

        // 인증 반경 원
        if (thresholdMeters) {
          new kakao.maps.Circle({
            center: pos,
            radius: thresholdMeters,
            strokeWeight: 1,
            strokeColor: "#1f3d2b",
            strokeOpacity: 0.8,
            fillColor: "#3f7d54",
            fillOpacity: 0.12,
            map,
          });
        }
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message === "NO_KEY" ? "NO_KEY" : "FAILED");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lng]);

  // 사용자 위치 마커 — userLoc 가 바뀔 때 갱신하고 두 지점이 모두 보이게 맞춤
  useEffect(() => {
    const kakao = window.kakao;
    const map = mapRef.current;
    if (!kakao || !map || !userLoc) return;

    const userPos = new kakao.maps.LatLng(userLoc.lat, userLoc.lng);
    if (userMarkerRef.current) userMarkerRef.current.setMap(null);

    // 파란 점으로 "내 위치" 표시
    userMarkerRef.current = new kakao.maps.CustomOverlay({
      position: userPos,
      content:
        '<div style="width:14px;height:14px;background:#2563eb;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 2px rgba(37,99,235,.4);"></div>',
      map,
    });

    // 가게 + 내 위치가 모두 보이게 범위 맞춤
    const bounds = new kakao.maps.LatLngBounds();
    bounds.extend(new kakao.maps.LatLng(center.lat, center.lng));
    bounds.extend(userPos);
    map.setBounds(bounds, 40);
  }, [userLoc, center.lat, center.lng]);

  if (error) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-1 rounded-2xl border border-stone-200 bg-stone-50 text-center text-stone-400 ${className}`}
        style={{ height }}
      >
        <MapPin size={22} strokeWidth={1.6} />
        <span className="text-xs font-medium">
          {error === "NO_KEY" ? "지도 키 설정 후 표시됩니다" : "지도를 불러오지 못했어요"}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={boxRef}
      className={`overflow-hidden rounded-2xl border border-stone-200 ${className}`}
      style={{ height }}
    />
  );
}
