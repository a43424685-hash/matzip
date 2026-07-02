/**
 * 카카오 로컬(키워드) API로 검색어를 좌표로 변환.
 * "강남 맛집", "충무로역 3번출구", "쌍문동" 등 무한한 위치 표현을 카카오가 좌표로 해석한다.
 * KAKAO_REST_API_KEY 필요. 실패 시 null → 호출부는 좌표 없이(카테고리만) 처리.
 */
export async function geocodeKeyword(query: string): Promise<{ lat: number; lng: number } | null> {
  const p = await geocodePlace(query);
  return p ? { lat: p.lat, lng: p.lng } : null;
}

export interface PlaceInfo {
  lat: number;
  lng: number;
  placeName: string;
  address: string; // 지번 주소
  roadAddress: string; // 도로명 주소
  category: string; // 카카오 카테고리 (예: "음식점 > 한식 > 곰탕")
}

/** 키워드 → 장소 상세(좌표·상호명·주소·카테고리). 운영자 일괄등록 enrich용. */
export async function geocodePlace(query: string): Promise<PlaceInfo | null> {
  const key = process.env.KAKAO_REST_API_KEY;
  const q = query.trim();
  if (!key || !q) return null;
  try {
    const res = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(q)}&size=1`,
      { headers: { Authorization: `KakaoAK ${key}` }, cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      documents?: { x: string; y: string; place_name?: string; address_name?: string; road_address_name?: string; category_name?: string }[];
    };
    const doc = data.documents?.[0];
    if (!doc) return null;
    const lat = parseFloat(doc.y);
    const lng = parseFloat(doc.x);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return {
      lat,
      lng,
      placeName: doc.place_name ?? "",
      address: doc.address_name ?? "",
      roadAddress: doc.road_address_name ?? "",
      category: doc.category_name ?? "",
    };
  } catch {
    return null;
  }
}
