/**
 * 좌표 공통 검증 — 서버 액션·서비스 계층에서 함께 사용해 잘못된 좌표 유입을 막는다.
 * (기존 parseCoord 는 유한수만 확인했음)
 */

export function isFiniteCoord(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/** 위도 -90..90, 경도 -180..180 범위의 유효한 좌표쌍인지 */
export function isValidLatLng(lat: unknown, lng: unknown): lat is number {
  return (
    isFiniteCoord(lat) &&
    isFiniteCoord(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/** 위도·경도는 둘 다 있거나 둘 다 없어야 한다 (한쪽만 있으면 비정상) */
export function coordsPairConsistent(lat: unknown, lng: unknown): boolean {
  return (lat == null) === (lng == null);
}

// 국내 서비스 안전 범위 — 제주 마라도~강원 북부, 백령도~독도를 모두 포함하도록 넉넉하게.
// (정상 좌표를 배제하지 않는 것이 목적. 정밀 필터가 아님)
export const KOREA_BOUNDS = { minLat: 32.9, maxLat: 38.7, minLng: 124.4, maxLng: 132.2 } as const;

export function isWithinKorea(lat: number, lng: number): boolean {
  return (
    lat >= KOREA_BOUNDS.minLat &&
    lat <= KOREA_BOUNDS.maxLat &&
    lng >= KOREA_BOUNDS.minLng &&
    lng <= KOREA_BOUNDS.maxLng
  );
}
