/**
 * 유료 맛집 지도 샘플 시드 (PG 심사 "상품 등록" 통과용).
 *  - 운영자 계정 소유로 공개 유료 컬렉션 몇 개 생성 (가격 노출)
 *  - 각 맛집 글은 위치·영수증·메뉴 3종 인증 처리 (정상 상품처럼 보이게)
 *  - 재실행 시 같은 제목의 기존 시드를 지우고 다시 생성 (idempotent)
 * 실행: npx tsx scripts/seed-paid-maps.ts
 * 비고: 심사 통과 후 무료 전환(setPaidMap false) 또는 삭제 가능.
 */
import { prisma } from "../src/lib/db";
import { createRestaurantPost } from "../src/server/restaurant/RestaurantService";

const OPERATOR_EMAIL = "zzllaa7788@daum.net";
const IMG = "/sample-food.svg";

// 지역별 중심 좌표 — 핀이 한 점에 겹치지 않게 가게마다 살짝 흩뿌린다.
const REGION_BASE: Record<string, { lat: number; lng: number }> = {
  서울: { lat: 37.5665, lng: 126.978 },
  부산: { lat: 35.1796, lng: 129.0756 },
};
function spreadCoord(region: string, idx: number) {
  const base = REGION_BASE[region] ?? REGION_BASE["서울"];
  // 인덱스마다 격자처럼 흩뿌림 (대략 0.6~1.2km 간격)
  return {
    latitude: base.lat + ((idx % 3) - 1) * 0.008 + Math.floor(idx / 3) * 0.006,
    longitude: base.lng + (((idx + 1) % 3) - 1) * 0.009,
  };
}

interface SeedMap {
  title: string;
  description: string;
  region: string;
  priceWon: number;
  restaurants: { name: string; review: string; cats: string[] }[];
}

const MAPS: SeedMap[] = [
  {
    title: "을지로·종로 직장인 점심 지도",
    description: "운영자가 직접 다닌 을지로·종로 점심 맛집 모음.",
    region: "서울",
    priceWon: 2900,
    restaurants: [
      { name: "을지로 노포 백반", review: "가성비 백반 끝판왕", cats: ["가성비", "혼밥"] },
      { name: "종로 손칼국수", review: "비 오는 날 국물 최고", cats: ["비 오는 날"] },
      { name: "광장시장 빈대떡", review: "막걸리랑 환상", cats: ["술집"] },
      { name: "을지면옥 평양냉면", review: "슴슴한 게 매력", cats: ["혼밥"] },
      { name: "종로 노포 곱창", review: "회식하기 딱", cats: ["회식", "술집"] },
    ],
  },
  {
    title: "성수 카페·디저트 지도",
    description: "성수동 감성 카페와 디저트 큐레이션.",
    region: "서울",
    priceWon: 1900,
    restaurants: [
      { name: "성수 로스터리 카페", review: "원두가 진하다", cats: ["카페", "데이트"] },
      { name: "서울숲 베이커리", review: "크루아상 겉바속촉", cats: ["카페"] },
      { name: "성수 티라미수 전문점", review: "디저트 인생샷", cats: ["카페", "데이트"] },
      { name: "연무장길 브런치", review: "주말 브런치 명소", cats: ["데이트"] },
    ],
  },
  {
    title: "부산 여행 갈맷길 맛집 지도",
    description: "부산 여행 코스에 딱 맞는 현지 맛집.",
    region: "부산",
    priceWon: 4900,
    restaurants: [
      { name: "광안리 회센터", review: "바다 보며 회 한 점", cats: ["데이트"] },
      { name: "서면 돼지국밥", review: "부산 오면 필수", cats: ["가성비", "혼밥"] },
      { name: "남포동 씨앗호떡", review: "줄 서서 먹는 간식", cats: ["가성비"] },
      { name: "해운대 밀면", review: "여름엔 역시 밀면", cats: ["혼밥"] },
      { name: "전포 카페거리 디저트", review: "분위기 좋은 카페", cats: ["카페", "데이트"] },
    ],
  },
];

async function main() {
  const op = await prisma.user.findUnique({ where: { email: OPERATOR_EMAIL }, select: { id: true } });
  if (!op) throw new Error(`운영자(${OPERATOR_EMAIL}) 계정이 없어요.`);

  const cats = await prisma.category.findMany({ select: { id: true, name: true } });
  const catId = (name: string) => cats.find((c) => c.name === name)?.id;

  // 기존 시드 정리 (같은 제목)
  const titles = MAPS.map((m) => m.title);
  const old = await prisma.collection.findMany({ where: { userId: op.id, title: { in: titles } }, select: { id: true } });
  if (old.length > 0) {
    await prisma.collectionItem.deleteMany({ where: { collectionId: { in: old.map((o) => o.id) } } });
    await prisma.collection.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
  }

  for (const m of MAPS) {
    const region = await prisma.region.findUnique({ where: { name: m.region }, select: { id: true } });
    if (!region) {
      console.log(`  ⚠️ 지역 '${m.region}' 없음 — 건너뜀`);
      continue;
    }

    const items: { restaurantId: string; postId: string }[] = [];
    let idx = 0;
    for (const r of m.restaurants) {
      const categoryIds = r.cats.map(catId).filter((x): x is string => !!x);
      const { latitude, longitude } = spreadCoord(m.region, idx++);
      const res = await createRestaurantPost({
        userId: op.id,
        name: r.name,
        primaryRegionId: region.id,
        shortReview: r.review,
        content: `${r.name} — ${r.review}`,
        priceRange: "10k_20k",
        revisitIntent: "yes",
        latitude,
        longitude,
        categoryIds,
        media: [{ type: "image", url: IMG }],
      });
      // 3종 인증 + 방문일 (정상 상품처럼)
      await prisma.restaurantPost.update({
        where: { id: res.postId },
        data: {
          locationVerified: true,
          receiptVerified: true,
          menuVerified: true,
          visitedAt: new Date(),
        },
      });
      items.push({ restaurantId: res.restaurantId, postId: res.postId });
    }

    const col = await prisma.collection.create({
      data: {
        userId: op.id,
        title: m.title,
        description: m.description,
        regionId: region.id,
        isPublic: true,
        isPaid: true,
        priceWon: m.priceWon,
        items: {
          create: items.map((it, i) => ({ restaurantId: it.restaurantId, postId: it.postId, sortOrder: i })),
        },
      },
      select: { id: true },
    });
    console.log(`  ✓ ${m.title} (${m.priceWon.toLocaleString()}원, ${items.length}곳) → /collections/${col.id}`);
  }

  const paidCount = await prisma.collection.count({ where: { isPaid: true, isPublic: true } });
  console.log(`\n✅ 유료 맛집 지도 시드 완료 — 현재 공개 유료 지도 ${paidCount}개`);
}

main().finally(() => prisma.$disconnect());
