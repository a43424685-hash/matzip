/**
 * PlaceSearchService — 장소/주소 검색으로 "권위 있는 좌표"를 확보한다.
 * (사용자 GPS 부트스트랩 대신 검색 출처의 좌표를 써서 위치 인증 어뷰징을 막는다)
 *
 * Provider: KAKAO_REST_API_KEY 가 있으면 카카오 로컬, 없으면 무료 OSM Nominatim.
 */

export interface PlaceResult {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  regionName: string | null; // 우리 17개 시도 중 매칭된 이름
  kakaoPlaceId: string | null; // 카카오 장소 고유 ID (중복 가게 판별용). 카카오 검색만 있음.
}

/** 주소 문자열 → 17개 시도 이름 매핑 */
const REGION_MARKERS: { marker: RegExp; region: string }[] = [
  { marker: /서울/, region: "서울" },
  { marker: /부산/, region: "부산" },
  { marker: /대구/, region: "대구" },
  { marker: /인천/, region: "인천" },
  { marker: /광주/, region: "광주" },
  { marker: /대전/, region: "대전" },
  { marker: /울산/, region: "울산" },
  { marker: /세종/, region: "세종" },
  { marker: /경기/, region: "경기" },
  { marker: /강원/, region: "강원" },
  { marker: /충청북도|충북/, region: "충북" },
  { marker: /충청남도|충남/, region: "충남" },
  { marker: /전라북도|전북/, region: "전북" },
  { marker: /전라남도|전남/, region: "전남" },
  { marker: /경상북도|경북/, region: "경북" },
  { marker: /경상남도|경남/, region: "경남" },
  { marker: /제주/, region: "제주" },
];

export function regionFromAddress(address: string): string | null {
  for (const { marker, region } of REGION_MARKERS) {
    if (marker.test(address)) return region;
  }
  return null;
}

export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const q = query.trim();
  if (!q) return [];
  if (process.env.KAKAO_REST_API_KEY) return searchKakao(q);
  return searchNominatim(q);
}

// ─────────────────────────────────────────────────────────────
// OSM Nominatim (무료, 키 불필요)
// ─────────────────────────────────────────────────────────────
async function searchNominatim(q: string): Promise<PlaceResult[]> {
  const url =
    "https://nominatim.openstreetmap.org/search?" +
    new URLSearchParams({
      format: "jsonv2",
      addressdetails: "1",
      "accept-language": "ko",
      countrycodes: "kr",
      limit: "6",
      q,
    });
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "matzip-levelup/1.0 (dev)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as NominatimItem[];
    return data
      .map((d) => {
        const address = d.display_name ?? "";
        const stateText = d.address?.state ?? d.address?.province ?? address;
        return {
          name: d.name || address.split(",")[0]?.trim() || "장소",
          address,
          latitude: Number(d.lat),
          longitude: Number(d.lon),
          regionName: regionFromAddress(stateText) ?? regionFromAddress(address),
          kakaoPlaceId: null, // OSM 은 카카오 ID 없음
        };
      })
      .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
  } catch {
    return [];
  }
}

interface NominatimItem {
  display_name?: string;
  name?: string;
  lat: string;
  lon: string;
  address?: { state?: string; province?: string };
}

// ─────────────────────────────────────────────────────────────
// 카카오 로컬 (KAKAO_REST_API_KEY 있을 때 우선)
// ─────────────────────────────────────────────────────────────
async function searchKakao(q: string): Promise<PlaceResult[]> {
  const url =
    "https://dapi.kakao.com/v2/local/search/keyword.json?" +
    new URLSearchParams({ query: q, size: "15" }); // 카카오 키워드 검색 1페이지 최대치
  try {
    const res = await fetch(url, {
      headers: { Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { documents?: KakaoDoc[] };
    return (data.documents ?? []).map((d) => {
      const address = d.road_address_name || d.address_name || "";
      return {
        name: d.place_name,
        address,
        latitude: Number(d.y),
        longitude: Number(d.x),
        regionName: regionFromAddress(address),
        kakaoPlaceId: d.id ?? null,
      };
    });
  } catch {
    return [];
  }
}

interface KakaoDoc {
  id?: string; // 카카오 장소 고유 ID
  place_name: string;
  address_name?: string;
  road_address_name?: string;
  x: string; // lng
  y: string; // lat
}

// ─────────────────────────────────────────────────────────────
// 역지오코딩 — 좌표 → 정확한 주소 (저장된 주소가 없어도 좌표만 있으면 가져온다)
// 카카오 우선(도로명), 없으면 무료 OSM Nominatim
// ─────────────────────────────────────────────────────────────
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<string | null> {
  if (process.env.KAKAO_REST_API_KEY) {
    const addr = await reverseGeocodeKakao(lat, lng);
    if (addr) return addr;
  }
  return reverseGeocodeNominatim(lat, lng);
}

async function reverseGeocodeKakao(lat: number, lng: number): Promise<string | null> {
  const url =
    "https://dapi.kakao.com/v2/local/geo/coord2address.json?" +
    new URLSearchParams({ x: String(lng), y: String(lat) });
  try {
    const res = await fetch(url, {
      headers: { Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}` },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      documents?: { road_address?: { address_name?: string }; address?: { address_name?: string } }[];
    };
    const doc = data.documents?.[0];
    // 도로명 주소 우선, 없으면 지번 주소
    return doc?.road_address?.address_name || doc?.address?.address_name || null;
  } catch {
    return null;
  }
}

async function reverseGeocodeNominatim(lat: number, lng: number): Promise<string | null> {
  const url =
    "https://nominatim.openstreetmap.org/reverse?" +
    new URLSearchParams({
      format: "jsonv2",
      "accept-language": "ko",
      lat: String(lat),
      lon: String(lng),
    });
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "matzip-levelup/1.0 (dev)" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { display_name?: string };
    return data.display_name ?? null;
  } catch {
    return null;
  }
}
