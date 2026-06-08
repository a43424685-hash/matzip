import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 대한민국 17개 시도 (MVP 활성 지역)
const REGIONS = [
  "서울", "경기", "인천", "부산", "대구", "대전", "광주", "울산", "세종",
  "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
];

// 카테고리 — "가고 싶은 이유" 중심. DB seed로 관리(하드코딩 금지).
// type: situation | season | credential | food | price
const CATEGORIES: { name: string; type: string }[] = [
  // 상황/욕구 기반
  ...[
    "가성비", "분위기", "데이트", "혼밥", "회식", "가족", "아이랑 가기 좋음",
    "부모님 모시기 좋음", "2차", "술집", "야장", "노포", "신상", "웨이팅 감수",
    "주차 편함", "조용함", "단체 가능",
  ].map((name) => ({ name, type: "situation" })),
  // 날씨/계절 기반
  ...[
    "비 오는 날", "추운 날", "더운 날", "날씨 좋은 날",
    "봄 시즌", "여름 계절메뉴", "가을 분위기", "겨울 국물",
  ].map((name) => ({ name, type: "season" })),
  // 인증/신뢰 기반
  ...[
    "미슐랭", "블루리본", "생활의달인", "백년가게", "로컬 추천", "오래된 맛집",
  ].map((name) => ({ name, type: "credential" })),
  // 음식 종류
  ...[
    "한식", "중식", "일식", "양식", "분식", "고기", "회/해산물",
    "국밥/탕", "면", "카페", "디저트", "베이커리", "바/와인",
  ].map((name) => ({ name, type: "food" })),
  // 가격대 (검색 필터 priceRange 와 별개로 태그로도 존재)
  ...[
    "1만원 이하", "1~2만원", "2~4만원", "4만원 이상",
  ].map((name) => ({ name, type: "price" })),
];

async function main() {
  console.log("Seeding regions...");
  for (let i = 0; i < REGIONS.length; i++) {
    const name = REGIONS[i];
    await prisma.region.upsert({
      where: { name },
      update: { isActive: true, sortOrder: i, type: "province" },
      create: { name, type: "province", isActive: true, sortOrder: i },
    });
  }

  console.log("Seeding categories...");
  for (let i = 0; i < CATEGORIES.length; i++) {
    const { name, type } = CATEGORIES[i];
    await prisma.category.upsert({
      where: { name },
      update: { type, isActive: true, sortOrder: i },
      create: { name, type, isActive: true, sortOrder: i },
    });
  }

  const regionCount = await prisma.region.count();
  const categoryCount = await prisma.category.count();
  console.log(`Done. regions=${regionCount}, categories=${categoryCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
