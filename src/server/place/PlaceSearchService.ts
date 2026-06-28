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
  categoryName: string | null; // 카카오 원본 분류 (예: "음식점 > 한식 > 국밥")
  foodCategory: string | null; // 우리 음식 종류로 매핑된 값 (예: "한식"). 등록 시 자동 선택용.
}

/**
 * 카카오 분류 문자열("음식점 > 한식 > 국밥") → 우리 음식 종류 카테고리 이름으로 매핑.
 * 자동완성용. 매칭 실패 시 null → 사용자가 직접 고름.
 * 반환 문자열은 반드시 seed의 food 카테고리 name 과 정확히 일치해야 함.
 */
const FOOD_RULES: { re: RegExp; food: string }[] = [
  { re: /카페|커피|coffee/i, food: "카페" },
  { re: /베이커리|제과|빵/, food: "베이커리" },
  { re: /디저트|아이스크림|빙수|도넛|케이크/, food: "디저트" },
  { re: /바\b|와인|호프|주점|이자카야|펍|bar|포차/i, food: "바/와인" },
  { re: /회|해산물|조개|굴|생선|횟집|수산|해물|장어/, food: "회/해산물" },
  { re: /고기|육류|구이|삼겹|갈비|곱창|족발|보쌈|닭|치킨/, food: "고기" },
  { re: /국밥|탕|찌개|전골|해장|곰탕|설렁탕/, food: "국밥/탕" },
  { re: /국수|냉면|칼국수|우동|라멘|쌀국수|면\b/, food: "면" },
  { re: /일식|초밥|스시|돈가스|덮밥|규동/, food: "일식" },
  { re: /중식|중국집|중국요리|마라|딤섬/, food: "중식" },
  { re: /양식|파스타|스테이크|이탈리|피자|버거|멕시칸|브런치/, food: "양식" },
  { re: /분식|떡볶이|김밥|순대/, food: "분식" },
  { re: /한식|백반|한정식|국|밥/, food: "한식" },
];

export function foodCategoryFromKakao(categoryName: string | null): string | null {
  if (!categoryName) return null;
  for (const { re, food } of FOOD_RULES) {
    if (re.test(categoryName)) return food;
  }
  return null;
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
          categoryName: null, // OSM 은 분류 없음
          foodCategory: null,
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
        categoryName: d.category_name ?? null,
        foodCategory: foodCategoryFromKakao(d.category_name ?? null),
      };
    });
  } catch {
    return [];
  }
}

interface KakaoDoc {
  id?: string; // 카카오 장소 고유 ID
  place_name: string;
  category_name?: string; // 예: "음식점 > 한식 > 국밥"
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
