/**
 * 카카오 로컬(키워드) API로 검색어를 좌표로 변환.
 * "강남 맛집", "충무로역 3번출구", "쌍문동" 등 무한한 위치 표현을 카카오가 좌표로 해석한다.
 * KAKAO_REST_API_KEY 필요. 실패 시 null → 호출부는 좌표 없이(카테고리만) 처리.
 */
export async function geocodeKeyword(query: string): Promise<{ lat: number; lng: number } | null> {
  const key = process.env.KAKAO_REST_API_KEY;
  const q = query.trim();
  if (!key || !q) return null;
  try {
    const res = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(q)}&size=1`,
      { headers: { Authorization: `KakaoAK ${key}` }, cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { documents?: { x: string; y: string }[] };
    const doc = data.documents?.[0];
    if (!doc) return null;
    const lat = parseFloat(doc.y);
    const lng = parseFloat(doc.x);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}
