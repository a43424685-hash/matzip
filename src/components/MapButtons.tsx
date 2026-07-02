"use client";

import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { getPlatform } from "@/lib/nativeAuth";

/**
 * 외부 지도 열기 버튼 — 카카오 지도는 항상, 다른 하나는 플랫폼별:
 *  - 안드로이드 → 구글 지도
 *  - iOS/웹 → Apple 지도
 * (SSR 하이드레이션 위해 마운트 후 플랫폼 결정 — 기본 Apple)
 */
export default function MapButtons({
  lat,
  lng,
  name,
  address,
  kakaoUrl,
}: {
  lat: number;
  lng: number;
  name: string;
  address: string | null;
  kakaoUrl: string;
}) {
  const [isAndroid, setIsAndroid] = useState(false);
  useEffect(() => setIsAndroid(getPlatform() === "android"), []);

  const appleUrl = `https://maps.apple.com/?ll=${lat},${lng}&q=${encodeURIComponent(name)}`;
  const googleUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  const otherUrl = isAndroid ? googleUrl : appleUrl;
  const otherLabel = isAndroid ? "구글 지도" : "Apple 지도";
  void address; // 좌표가 있으므로 좌표 기반 링크 사용

  return (
    <div className="mt-2 grid grid-cols-2 gap-2">
      <a href={otherUrl} target="_blank" rel="noreferrer" className="btn-outline h-10 !text-sm">
        <MapPin size={15} /> {otherLabel}
      </a>
      <a href={kakaoUrl} target="_blank" rel="noreferrer" className="btn-outline h-10 !text-sm">
        <MapPin size={15} /> 카카오 지도
      </a>
    </div>
  );
}
