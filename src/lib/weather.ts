/**
 * 기상청 초단기실황(getUltraSrtNcst) 기반 현재 날씨 조회.
 * data.go.kr 공공데이터포털 서비스키 필요 (env: KMA_SERVICE_KEY).
 * GPS 위경도 → 기상청 격자(nx,ny) 변환은 기상청 표준 LCC(DFS) 공식.
 */

const KMA_ENDPOINT =
  "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst";
// 초단기예보 — 실황(Ncst)엔 하늘상태(SKY)가 없어서, 흐림 감지는 예보(Fcst)로 보완
const KMA_FCST_ENDPOINT =
  "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtFcst";

// 위경도 → 기상청 격자 좌표 (기상청 제공 표준 변환식)
export function latLonToGrid(lat: number, lon: number): { nx: number; ny: number } {
  const RE = 6371.00877; // 지구 반경(km)
  const GRID = 5.0; // 격자 간격(km)
  const SLAT1 = 30.0, SLAT2 = 60.0; // 표준 위도
  const OLON = 126.0, OLAT = 38.0; // 기준점 경위도
  const XO = 43, YO = 136; // 기준점 격자
  const DEGRAD = Math.PI / 180.0;

  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD;
  const slat2 = SLAT2 * DEGRAD;
  const olon = OLON * DEGRAD;
  const olat = OLAT * DEGRAD;

  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = (re * sf) / Math.pow(ro, sn);

  let ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5);
  ra = (re * sf) / Math.pow(ra, sn);
  let theta = lon * DEGRAD - olon;
  if (theta > Math.PI) theta -= 2.0 * Math.PI;
  if (theta < -Math.PI) theta += 2.0 * Math.PI;
  theta *= sn;

  const nx = Math.floor(ra * Math.sin(theta) + XO + 0.5);
  const ny = Math.floor(ro - ra * Math.cos(theta) + YO + 0.5);
  return { nx, ny };
}

// 실황 발표(매시각 40분 생성, 이후 제공) 기준 base_date/base_time 계산.
// ⚠️ 반드시 한국시간(KST) 기준. 서버(Vercel)가 UTC라 로컬시간 쓰면 9시간 전 날씨를 불러온다.
function baseDateTime(now: Date): { base_date: string; base_time: string } {
  // UTC+9로 시프트한 뒤 getUTC* 로 읽으면 KST 시각이 된다
  const d = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  // 아직 이번 시각 실황이 안 올라온 경우(정시~40분) 한 시간 전 데이터 사용
  if (d.getUTCMinutes() < 45) d.setTime(d.getTime() - 60 * 60 * 1000);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  return { base_date: `${yyyy}${mm}${dd}`, base_time: `${hh}00` };
}

// 8종: 태풍·비·눈·더움·습함·추움·흐림·맑음
export type WeatherCondition = "storm" | "rain" | "snow" | "hot" | "humid" | "cold" | "cloudy" | "nice";

export interface CurrentWeather {
  condition: WeatherCondition;
  tempC: number | null;
  pty: number; // 강수형태 코드
  humidity: number | null; // 습도 %
  windMs: number | null; // 풍속 m/s
  emoji: string;
  label: string; // 헤드라인
}

const LABELS: Record<WeatherCondition, { emoji: string; label: string }> = {
  storm: { emoji: "⛈️", label: "이런 날은 나가지 말고, 근처 딱 한 곳" },
  rain: { emoji: "🌧️", label: "비 오는 날, 뜨끈한 국물 한 그릇" },
  snow: { emoji: "❄️", label: "눈 오는 날, 따뜻한 자리로" },
  hot: { emoji: "🥵", label: "더운 날, 시원하게 한 방" },
  humid: { emoji: "💧", label: "꿉꿉한 날, 개운한 메뉴 어때요?" },
  cold: { emoji: "🥶", label: "추운 날, 속 데우는 맛집" },
  cloudy: { emoji: "☁️", label: "흐린 날, 뜨끈하게 한 그릇 어때요?" },
  nice: { emoji: "☀️", label: "날씨 좋은 날, 이런 곳 어때요?" },
};

function classify(
  tempC: number | null,
  pty: number,
  reh: number | null,
  wsd: number | null,
  sky: number | null // 하늘상태(예보): 1 맑음, 3 구름많음, 4 흐림
): WeatherCondition {
  const raining = pty === 1 || pty === 2 || pty === 5 || pty === 6;
  const snowing = pty === 3 || pty === 7;
  if (raining && wsd != null && wsd >= 9) return "storm"; // 비 + 강풍(9m/s↑) = 태풍/폭풍
  if (snowing) return "snow";
  if (raining) return "rain";
  if (tempC != null && tempC >= 28) return "hot";
  if (tempC != null && tempC <= 4) return "cold";
  if (reh != null && reh >= 80 && tempC != null && tempC >= 21) return "humid"; // 따뜻+습함=장마느낌
  if (sky != null && sky >= 3) return "cloudy"; // 구름많음(3)·흐림(4) = 흐림
  return "nice";
}

// 날씨 → 앱 카테고리(이름) 매핑. 시드된 category 이름과 정확히 일치해야 함.
export const WEATHER_CATEGORIES: Record<WeatherCondition, string[]> = {
  // 각 날씨 → 핵심 날씨태그(4종 중 하나) + 어울리는 음식 카테고리(폴백)
  storm: ["비 오는 날", "국밥/탕", "술집"],
  rain: ["비 오는 날", "국밥/탕", "술집"],
  snow: ["추운 날", "국밥/탕"],
  hot: ["더운 날", "면", "카페"],
  humid: ["더운 날", "면", "회/해산물"],
  cold: ["추운 날", "국밥/탕"],
  cloudy: ["국밥/탕", "술집", "카페"],
  nice: ["날씨 좋은 날", "데이트", "카페"],
};

// 초단기예보에서 하늘상태(SKY) 조회 (1 맑음, 3 구름많음, 4 흐림)
async function getSkyState(key: string, nx: number, ny: number, now: Date): Promise<number | null> {
  const d = new Date(now.getTime() + 9 * 60 * 60 * 1000); // KST
  // 초단기예보: 매시 30분 발표, 45분 이후 제공
  if (d.getUTCMinutes() < 45) d.setTime(d.getTime() - 60 * 60 * 1000);
  const base_date = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  const base_time = `${String(d.getUTCHours()).padStart(2, "0")}30`;
  const qs = new URLSearchParams({
    serviceKey: key, pageNo: "1", numOfRows: "60", dataType: "JSON",
    base_date, base_time, nx: String(nx), ny: String(ny),
  });
  try {
    const res = await fetch(`${KMA_FCST_ENDPOINT}?${qs.toString()}`, { next: { revalidate: 600 } });
    if (!res.ok) return null;
    const json = await res.json();
    const items: { category: string; fcstTime: string; fcstValue: string }[] =
      json?.response?.body?.items?.item ?? [];
    const skyItems = items
      .filter((i) => i.category === "SKY")
      .sort((a, b) => a.fcstTime.localeCompare(b.fcstTime));
    return skyItems.length ? Number(skyItems[0].fcstValue) : null;
  } catch {
    return null;
  }
}

/** 현재 날씨 조회. 키/네트워크 문제 시 null (섹션 자체를 숨김). */
export async function getCurrentWeather(lat: number, lon: number): Promise<CurrentWeather | null> {
  const key = process.env.KMA_SERVICE_KEY;
  if (!key) return null;

  const { nx, ny } = latLonToGrid(lat, lon);
  const { base_date, base_time } = baseDateTime(new Date());
  const qs = new URLSearchParams({
    serviceKey: key,
    pageNo: "1",
    numOfRows: "60",
    dataType: "JSON",
    base_date,
    base_time,
    nx: String(nx),
    ny: String(ny),
  });

  try {
    // 같은 격자·발표시각이면 결과가 동일 → 10분 캐시(첫 호출만 느리고 이후 즉시)
    const res = await fetch(`${KMA_ENDPOINT}?${qs.toString()}`, { next: { revalidate: 600 } });
    if (!res.ok) return null;
    const json = await res.json();
    const items: { category: string; obsrValue: string }[] =
      json?.response?.body?.items?.item ?? [];
    if (!items.length) return null;

    let tempC: number | null = null;
    let pty = 0;
    let humidity: number | null = null;
    let windMs: number | null = null;
    for (const it of items) {
      if (it.category === "T1H") tempC = Number(it.obsrValue);
      else if (it.category === "PTY") pty = Number(it.obsrValue);
      else if (it.category === "REH") humidity = Number(it.obsrValue);
      else if (it.category === "WSD") windMs = Number(it.obsrValue);
    }
    // 흐림 감지용 하늘상태(예보) — 실패해도 null로 두고 나머지로 분류
    const sky = await getSkyState(key, nx, ny, new Date());
    const condition = classify(tempC, pty, humidity, windMs, sky);
    return { condition, tempC, pty, humidity, windMs, ...LABELS[condition] };
  } catch {
    return null;
  }
}
