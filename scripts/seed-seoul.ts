/**
 * 서울 검색 밀도 시드 — 초기 검색/지도가 비어 보이지 않도록 운영자 소유 "무료 공개" 맛집을
 * 서울 주요 동네에 깔아둔다. (유료 컬렉션이 아니라, 검색에 바로 뜨는 개별 공개 맛집)
 *
 *  - 운영자(OPERATOR_EMAIL) 소유, locationVerified=true, visibility="public"
 *  - 좌표: KAKAO_REST_API_KEY 있으면 카카오로 실제 좌표/주소/카테고리 자동, 없으면 동네 기준 좌표로 흩뿌림
 *  - 재실행 안전(idempotent): 운영자가 이미 같은 이름 맛집을 등록했으면 건너뜀
 *
 * 실행: npx tsx scripts/seed-seoul.ts
 * 비고: 데이터 추가만 함(삭제 없음). 심사 중인 정식 앱에 영향 없음(추가 데이터).
 */
import { prisma } from "../src/lib/db";
import { createRestaurantPost } from "../src/server/restaurant/RestaurantService";
import { searchPlaces, foodCategoryFromKakao } from "../src/server/place/PlaceSearchService";

const OPERATOR_EMAIL = "zzllaa7788@daum.net";
const IMG = "/sample-food.svg";

// 동네 기준 좌표 (카카오 실패 시 fallback) — 실제 좌표에 근접
const AREA_BASE: Record<string, { lat: number; lng: number }> = {
  강남: { lat: 37.4979, lng: 127.0276 },
  홍대: { lat: 37.5563, lng: 126.922 },
  연남동: { lat: 37.5642, lng: 126.9255 },
  을지로: { lat: 37.566, lng: 126.991 },
  종로: { lat: 37.5704, lng: 126.9826 },
  성수: { lat: 37.5446, lng: 127.056 },
  이태원: { lat: 37.5345, lng: 126.9946 },
  여의도: { lat: 37.5219, lng: 126.9245 },
  수유: { lat: 37.6379, lng: 127.0255 },
  잠실: { lat: 37.5133, lng: 127.1 },
};

function spread(area: string, idx: number) {
  const base = AREA_BASE[area] ?? AREA_BASE["강남"];
  return {
    latitude: base.lat + ((idx % 3) - 1) * 0.0035 + Math.floor(idx / 3) * 0.0025,
    longitude: base.lng + (((idx + 1) % 3) - 1) * 0.004,
  };
}

interface Seed {
  area: string;
  name: string;
  review: string;
  cats: string[]; // 상황/분위기 태그 (seed의 situation 카테고리 이름과 일치)
}

const SEEDS: Seed[] = [
  // 강남
  { area: "강남", name: "강남 노포 곱창", review: "회식엔 역시 곱창", cats: ["회식", "술집"] },
  { area: "강남", name: "강남역 국밥집", review: "해장으로 든든", cats: ["가성비", "혼밥"] },
  { area: "강남", name: "강남 파스타 비스트로", review: "데이트하기 좋은 분위기", cats: ["데이트", "분위기"] },
  { area: "강남", name: "강남 초밥 오마카세", review: "특별한 날 추천", cats: ["데이트"] },
  // 홍대 / 연남
  { area: "홍대", name: "홍대 떡볶이 분식", review: "학생 가성비 끝판왕", cats: ["가성비", "혼밥"] },
  { area: "홍대", name: "홍대 수제버거", review: "패티가 두툼", cats: ["혼밥"] },
  { area: "연남동", name: "연남동 감성 카페", review: "사진 맛집", cats: ["카페", "데이트"] },
  { area: "연남동", name: "연남 노포 술집", review: "2차로 딱", cats: ["2차", "술집"] },
  // 을지로 / 종로
  { area: "을지로", name: "을지로 노가리 호프", review: "퇴근 후 한 잔", cats: ["술집", "2차"] },
  { area: "을지로", name: "을지면옥 평양냉면", review: "슴슴함의 매력", cats: ["혼밥"] },
  { area: "종로", name: "광장시장 빈대떡", review: "막걸리랑 환상", cats: ["술집", "가성비"] },
  { area: "종로", name: "종로 손칼국수", review: "비 오는 날 국물 최고", cats: ["가성비", "혼밥"] },
  // 성수
  { area: "성수", name: "성수 로스터리 카페", review: "원두가 진하다", cats: ["카페", "데이트"] },
  { area: "성수", name: "서울숲 베이커리", review: "크루아상 겉바속촉", cats: ["카페"] },
  { area: "성수", name: "성수 수제 파스타", review: "데이트 분위기", cats: ["데이트", "분위기"] },
  { area: "성수", name: "성수 곱창 노포", review: "줄 서는 집", cats: ["회식", "웨이팅 감수"] },
  // 이태원
  { area: "이태원", name: "이태원 타코 멕시칸", review: "이국적인 맛", cats: ["데이트"] },
  { area: "이태원", name: "이태원 루프탑 바", review: "야경 끝내줌", cats: ["분위기", "데이트"] },
  { area: "이태원", name: "경리단길 브런치", review: "주말 브런치 명소", cats: ["데이트"] },
  // 여의도
  { area: "여의도", name: "여의도 직장인 백반", review: "점심 가성비", cats: ["가성비", "혼밥"] },
  { area: "여의도", name: "여의도 한정식", review: "부모님 모시기 좋음", cats: ["부모님 모시기 좋음", "가족"] },
  { area: "여의도", name: "여의도 횟집", review: "회식 단체 가능", cats: ["회식", "단체 가능"] },
  // 수유
  { area: "수유", name: "수유 노포 갈비", review: "동네 터줏대감", cats: ["노포", "가족"] },
  { area: "수유", name: "수유역 국밥", review: "혼밥하기 좋음", cats: ["혼밥", "가성비"] },
  { area: "수유", name: "수유시장 호떡", review: "줄 서는 간식", cats: ["가성비"] },
  // 잠실
  { area: "잠실", name: "잠실 가족 한식당", review: "아이랑 가기 좋음", cats: ["아이랑 가기 좋음", "가족"] },
  { area: "잠실", name: "잠실 분식집", review: "가성비 떡볶이", cats: ["가성비", "혼밥"] },
  { area: "잠실", name: "석촌호수 카페", review: "산책 후 커피", cats: ["카페", "데이트"] },
];

async function main() {
  const op = await prisma.user.findUnique({
    where: { email: OPERATOR_EMAIL },
    select: { id: true, isAdmin: true },
  });
  if (!op) throw new Error(`운영자(${OPERATOR_EMAIL}) 계정이 없어요. 먼저 가입/지정해주세요.`);

  const seoul = await prisma.region.findUnique({ where: { name: "서울" }, select: { id: true } });
  if (!seoul) throw new Error("'서울' 지역이 없어요. prisma db seed 를 먼저 실행하세요.");

  const cats = await prisma.category.findMany({ select: { id: true, name: true } });
  const catId = (name: string) => cats.find((c) => c.name === name)?.id;

  // 이미 운영자가 등록한 이름 모음 (idempotent)
  const existing = await prisma.restaurantPost.findMany({
    where: { userId: op.id, restaurant: { primaryRegionId: seoul.id } },
    select: { restaurant: { select: { name: true } } },
  });
  const existingNames = new Set(existing.map((e) => e.restaurant.name));

  const hasKakao = !!process.env.KAKAO_REST_API_KEY;
  console.log(`서울 시드 시작 — 카카오 지오코딩: ${hasKakao ? "사용" : "미사용(동네 좌표 fallback)"}`);

  let created = 0;
  let skipped = 0;
  const perAreaIdx: Record<string, number> = {};

  for (const s of SEEDS) {
    if (existingNames.has(s.name)) {
      skipped++;
      continue;
    }

    // 좌표/주소/카테고리 — 카카오 우선
    let latitude: number | null = null;
    let longitude: number | null = null;
    let address: string | null = null;
    let kakaoPlaceId: string | null = null;
    let foodCat: string | null = null;

    if (hasKakao) {
      try {
        const results = await searchPlaces(`${s.area} ${s.name}`);
        const hit = results.find((r) => Number.isFinite(r.latitude) && Number.isFinite(r.longitude));
        if (hit) {
          latitude = hit.latitude;
          longitude = hit.longitude;
          address = hit.address || null;
          kakaoPlaceId = hit.kakaoPlaceId;
          foodCat = hit.foodCategory ?? foodCategoryFromKakao(hit.categoryName);
        }
      } catch {
        /* fallback below */
      }
    }
    if (latitude == null || longitude == null) {
      const idx = (perAreaIdx[s.area] = (perAreaIdx[s.area] ?? 0) + 1) - 1;
      const c = spread(s.area, idx);
      latitude = c.latitude;
      longitude = c.longitude;
    }

    const categoryIds = [...s.cats.map(catId), foodCat ? catId(foodCat) : undefined].filter(
      (x): x is string => !!x
    );

    const res = await createRestaurantPost({
      userId: op.id,
      name: s.name,
      primaryRegionId: seoul.id,
      address,
      kakaoPlaceId,
      latitude,
      longitude,
      shortReview: s.review,
      content: `${s.name} — ${s.review}`,
      priceRange: "10k_20k",
      categoryIds,
      visibility: "public",
      media: [{ type: "image", url: IMG }],
    });

    // 검색 노출 조건(locationVerified) 충족 — 운영자 시드는 인증된 것으로 처리
    await prisma.restaurantPost.update({
      where: { id: res.postId },
      data: { locationVerified: true, visitedAt: new Date() },
    });
    created++;
    console.log(`  + ${s.area} · ${s.name}`);
  }

  console.log(`완료. 생성=${created}, 건너뜀(이미 있음)=${skipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
