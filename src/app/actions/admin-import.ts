"use server";

/**
 * 운영자 전용 — 네이버 즐겨찾기(공유링크)에서 맛집을 일괄로 "운영자 PICK"으로 등록.
 *  - 네이버 공유폴더 API에서 상호·주소·좌표·카테고리 자동 추출
 *  - 사진/한줄평/상황태그/가격은 운영자가 채움(전부 선택)
 *  - 운영자 계정으로 createRestaurantPost → 자동 위치인증 → 바로 노출
 */
import { prisma } from "@/lib/db";
import { getSessionAdmin } from "@/lib/auth";
import { createRestaurantPost } from "@/server/restaurant/RestaurantService";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
// Accept-Language 없으면 네이버가 영문 상호명을 반환함 → 한글 강제
const NAVER_HEADERS = { "User-Agent": UA, "Accept-Language": "ko-KR,ko;q=0.9" };

// 주소 앞부분(시/도) → region.name (서울/경기/부산…)
function provinceFromAddress(addr: string): string | null {
  const head = (addr || "").trim().split(/\s+/)[0] ?? "";
  const norm = head.replace(/특별자치도|특별자치시|특별시|광역시|자치도|자치시/g, "").replace(/도$|시$/, "");
  const map: Record<string, string> = {
    서울: "서울", 부산: "부산", 대구: "대구", 인천: "인천", 광주: "광주", 대전: "대전",
    울산: "울산", 세종: "세종", 경기: "경기", 강원: "강원", 충북: "충북", 충남: "충남",
    전북: "전북", 전남: "전남", 경북: "경북", 경남: "경남", 제주: "제주",
    충청북: "충북", 충청남: "충남", 전라북: "전북", 전라남: "전남", 경상북: "경북", 경상남: "경남",
  };
  return map[norm] ?? map[head] ?? null;
}

// 네이버 카테고리 문자열 → 앱 음식 카테고리명 (휴리스틱, 운영자가 수정 가능)
const FOOD_RULES: [string, string[]][] = [
  ["국밥/탕", ["국밥", "탕", "순대국", "설렁탕", "곰탕", "해장국", "감자탕", "갈비탕"]],
  ["회/해산물", ["회", "해산물", "복어", "해물", "수산", "조개", "굴", "생선", "활어", "대게", "장어", "아구", "물회"]],
  ["일식", ["일식", "스시", "초밥", "사시미", "라멘", "돈카츠", "돈가스", "이자카야", "우동", "규동", "오마카세", "텐동"]],
  ["고기", ["고기", "구이", "삼겹", "갈비", "소고기", "돼지", "정육", "곱창", "막창", "족발", "닭갈비", "불고기", "스테이크하우스", "양꼬치"]],
  ["중식", ["중식", "중국", "짜장", "짬뽕", "마라", "딤섬", "탕수육"]],
  ["양식", ["양식", "파스타", "피자", "스테이크", "이탈리", "프렌치", "브런치", "버거", "멕시", "스페인", "다이닝"]],
  ["분식", ["분식", "떡볶이", "김밥", "튀김"]],
  ["면", ["면", "국수", "냉면", "칼국수", "막국수", "소바"]],
  ["베이커리", ["베이커리", "빵", "제과", "베이글", "도넛"]],
  ["디저트", ["디저트", "케이크", "빙수", "아이스크림", "마카롱", "와플", "타르트", "젤라또"]],
  ["카페", ["카페", "커피", "로스터리", "티룸"]],
  ["바/와인", ["바", "bar", "와인", "위스키", "칵테일", "술집", "주점", "호프", "포차", "포장마차", "펍", "맥주", "이자카야"]],
  ["한식", ["한식", "백반", "한정식", "찌개", "보쌈", "쌈밥", "비빔밥", "죽", "전", "한정식"]],
];
function foodCategoryName(naverCat: string): string | null {
  const c = (naverCat || "").toLowerCase();
  for (const [name, keys] of FOOD_RULES) {
    if (keys.some((k) => c.includes(k.toLowerCase()))) return name;
  }
  return null;
}

const norm = (s: string) => (s || "").replace(/\s+/g, "").toLowerCase();
function distM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface ParsedPlace {
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  naverCategory: string;
  regionId: string;
  regionName: string;
  foodCategoryId: string | null;
  foodCategoryName: string | null;
  duplicate: boolean; // 이미 등록된(글 있는) 가게인지 — true면 등록에서 제외
}

/** 네이버 즐겨찾기 공유링크 → 장소 목록 (운영자 전용) */
export async function parseNaverFolder(rawUrl: string): Promise<{ folderName: string; places: ParsedPlace[] }> {
  const admin = await getSessionAdmin();
  if (!admin?.isAdmin) throw new Error("FORBIDDEN");

  // folderId 추출 (전체 URL or naver.me 단축링크)
  let folderId: string | null = rawUrl.match(/folder\/([0-9a-f]{16,})/i)?.[1] ?? null;
  if (!folderId) {
    const res = await fetch(rawUrl.trim(), { headers: NAVER_HEADERS, redirect: "follow" });
    folderId = res.url.match(/folder\/([0-9a-f]{16,})/i)?.[1] ?? null;
  }
  if (!folderId) throw new Error("링크에서 폴더를 찾지 못했어요. 네이버 즐겨찾기 '공유' 링크가 맞는지 확인해주세요.");

  const ref = `https://map.naver.com/p/favorite/sharedPlace/folder/${folderId}`;
  const bRes = await fetch(
    `https://pages.map.naver.com/save-pages/api/maps-bookmark/v3/shares/${folderId}/bookmarks`,
    { headers: { ...NAVER_HEADERS, Referer: ref, Accept: "application/json" } }
  );
  if (!bRes.ok) throw new Error("네이버에서 목록을 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
  const data = (await bRes.json()) as { folder?: { name?: string }; bookmarkList?: unknown[] };
  const list = (data.bookmarkList ?? []) as Record<string, unknown>[];

  const [regions, foods, existing] = await Promise.all([
    prisma.region.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
    prisma.category.findMany({ where: { isActive: true, type: "food" }, select: { id: true, name: true } }),
    // 이미 글이 있는(등록된) 가게 — 중복 판정용
    prisma.restaurant.findMany({
      where: { posts: { some: {} } },
      select: { name: true, primaryRegionId: true, latitude: true, longitude: true },
    }),
  ]);
  const regionByName = new Map(regions.map((r) => [r.name, r.id]));
  const foodByName = new Map(foods.map((f) => [f.name, f.id]));
  const seoulId = regionByName.get("서울") ?? regions[0]?.id ?? "";

  const isDuplicate = (name: string, regionId: string, lat: number | null, lng: number | null) =>
    existing.some((e) => {
      const sameName = norm(e.name) === norm(name);
      if (sameName && e.primaryRegionId === regionId) return true; // 같은 이름+지역
      if (lat != null && lng != null && e.latitude != null && e.longitude != null) {
        const d = distM(lat, lng, e.latitude, e.longitude);
        if (d < 40) return true; // 같은 자리(40m 이내)
        if (sameName && d < 300) return true; // 이름 같고 300m 이내
      }
      return false;
    });

  const places = await Promise.all(
    list.map(async (b): Promise<ParsedPlace> => {
      const name = String(b.name ?? "");
      const address = String(b.address ?? "");
      const lat = typeof b.py === "number" ? (b.py as number) : null;
      const lng = typeof b.px === "number" ? (b.px as number) : null;
      let naverCat = String(b.mcidName ?? "");
      try {
        const sRes = await fetch(`https://map.naver.com/p/api/place/summary/${b.sid}`, {
          headers: { ...NAVER_HEADERS, Referer: "https://map.naver.com/" },
        });
        if (sRes.ok) {
          const s = (await sRes.json()) as { data?: { placeDetail?: { category?: { category?: string } } } };
          const cat = s.data?.placeDetail?.category?.category;
          if (cat) naverCat = cat;
        }
      } catch {
        /* 상세 실패 시 mcidName 유지 */
      }
      const provName = provinceFromAddress(address);
      const regionId = (provName && regionByName.get(provName)) || seoulId;
      const foodName = foodCategoryName(naverCat);
      return {
        name,
        address,
        lat,
        lng,
        naverCategory: naverCat,
        regionId,
        regionName: provName ?? "서울",
        foodCategoryId: (foodName && foodByName.get(foodName)) || null,
        foodCategoryName: foodName,
        duplicate: isDuplicate(name, regionId, lat, lng),
      };
    })
  );

  return { folderName: String(data.folder?.name ?? ""), places };
}

export interface BulkItem {
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  regionId: string;
  foodCategoryId: string | null;
  situationCategoryIds: string[];
  priceRange: string | null;
  shortReview: string | null;
  media: { type: "image" | "video"; url: string; thumbnailUrl: string | null }[];
}

export interface BulkResult {
  name: string;
  ok: boolean;
  error?: string;
}

/** 일괄 등록 — 운영자 PICK 으로 (운영자 전용) */
export async function bulkCreateOperatorPicks(items: BulkItem[]): Promise<BulkResult[]> {
  const admin = await getSessionAdmin();
  if (!admin?.isAdmin) throw new Error("FORBIDDEN");

  const results: BulkResult[] = [];
  for (const it of items) {
    const categoryIds = [it.foodCategoryId, ...it.situationCategoryIds].filter(Boolean) as string[];
    if (categoryIds.length === 0) {
      results.push({ name: it.name, ok: false, error: "카테고리가 최소 1개 필요해요" });
      continue;
    }
    if (!it.regionId) {
      results.push({ name: it.name, ok: false, error: "지역 정보가 없어요" });
      continue;
    }
    // 중복 안전장치: 같은 이름+지역에 이미 글 있는 가게면 건너뜀
    const dup = await prisma.restaurant.findFirst({
      where: { name: it.name.trim(), primaryRegionId: it.regionId, posts: { some: {} } },
      select: { id: true },
    });
    if (dup) {
      results.push({ name: it.name, ok: false, error: "이미 등록된 맛집(건너뜀)" });
      continue;
    }
    try {
      const created = await createRestaurantPost({
        userId: admin.id,
        name: it.name,
        primaryRegionId: it.regionId,
        address: it.address,
        latitude: it.lat,
        longitude: it.lng,
        shortReview: it.shortReview?.trim() || null,
        categoryIds,
        priceRange: it.priceRange || null,
        media: it.media.map((m) => ({ type: m.type, url: m.url, thumbnailUrl: m.thumbnailUrl })),
        visibility: "public",
      });
      // 운영자 PICK = "가보고 싶어 찜한 곳"(실제 방문·인증 아님).
      // createRestaurantPost가 운영자라 자동 위치인증(true)으로 만들지만, PICK은 인증이 아니므로 되돌린다.
      await prisma.restaurantPost.update({
        where: { id: created.postId },
        data: { isOperatorPick: true, locationVerified: false, visitedAt: null },
      });
      results.push({ name: it.name, ok: true });
    } catch (e) {
      results.push({ name: it.name, ok: false, error: e instanceof Error ? e.message : "등록 실패" });
    }
  }
  return results;
}
