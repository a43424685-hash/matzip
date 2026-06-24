/**
 * 데모 데이터 시드 (프리뷰/테스트용) — 운영자만 트리거하는 API에서 호출.
 * 결정적 ID(demo-*)라 재실행해도 중복 안 생김(upsert). clean()으로 일괄 삭제.
 */
import { prisma } from "@/lib/db";

const FOODIES = [
  { n: "강남불주먹", lv: 187, xp: 920000, av: 12 },
  { n: "성수픽", lv: 142, xp: 610000, av: 5 },
  { n: "홍대0순위", lv: 121, xp: 470000, av: 32 },
  { n: "노포사냥꾼", lv: 95, xp: 300000, av: 14 },
  { n: "혼밥의신", lv: 78, xp: 205000, av: 8 },
  { n: "야장러버", lv: 61, xp: 140000, av: 47 },
  { n: "디저트요정", lv: 44, xp: 78000, av: 25 },
  { n: "국밥장인", lv: 30, xp: 39000, av: 60 },
  { n: "신상헌터", lv: 18, xp: 14000, av: 51 },
  { n: "초보미식가", lv: 7, xp: 2600, av: 33 },
];

const SPOTS = [
  { name: "을지로 골목집", short: "노포 감성 끝판왕, 노가리 무한", tags: ["노포", "술집"], price: "10k_20k" },
  { name: "성수 화덕피자", short: "도우가 미쳤다 진짜", tags: ["데이트", "분위기"], price: "20k_40k" },
  { name: "홍대 혼밥라멘", short: "1인석 완비, 국물 진함", tags: ["혼밥"], price: "under_10k" },
  { name: "강남 한우오마카세", short: "기념일엔 무조건 여기", tags: ["데이트"], price: "over_40k" },
  { name: "망원 야장포차", short: "여름밤 야장 분위기 최고", tags: ["야장", "술집"], price: "10k_20k" },
  { name: "연남 디저트카페", short: "케이크 비주얼+맛 둘다", tags: ["카페", "데이트"], price: "10k_20k" },
  { name: "종로 국밥노포", short: "30년 내공 국물", tags: ["노포"], price: "under_10k" },
  { name: "이태원 수제버거", short: "패티 두툼 육즙 폭발", tags: ["가성비"], price: "10k_20k" },
  { name: "광장시장 빈대떡", short: "막걸리 부르는 그 맛", tags: ["노포", "야장"], price: "under_10k" },
  { name: "압구정 브런치", short: "주말 브런치 성지", tags: ["분위기", "데이트"], price: "20k_40k" },
  { name: "신촌 곱창집", short: "직화 곱창 불맛", tags: ["회식", "술집"], price: "20k_40k" },
  { name: "잠실 마라탕", short: "얼큰하게 땀 빼는 곳", tags: ["가성비"], price: "10k_20k" },
  { name: "서촌 한정식", short: "부모님 모시고 가기 좋음", tags: ["가족"], price: "over_40k" },
  { name: "건대 떡볶이", short: "즉석 떡볶이 국룰", tags: ["가성비", "혼밥"], price: "under_10k" },
  { name: "여의도 회센터", short: "퇴근 후 회 한 점", tags: ["회식"], price: "20k_40k" },
  { name: "성북동 전통찻집", short: "조용히 차 한잔", tags: ["조용함", "카페"], price: "10k_20k" },
  { name: "강남 우동집", short: "사누키 우동 쫄깃", tags: ["혼밥"], price: "under_10k" },
  { name: "한남 와인바", short: "분위기 끝, 데이트용", tags: ["분위기", "바/와인"], price: "over_40k" },
];

const img = (seed: string) => `https://picsum.photos/seed/${seed}/600/450`;

export async function cleanDemo() {
  await prisma.collectionItem.deleteMany({ where: { collectionId: { startsWith: "demo-c" } } });
  await prisma.collection.deleteMany({ where: { id: { startsWith: "demo-c" } } });
  await prisma.media.deleteMany({ where: { postId: { startsWith: "demo-p" } } });
  await prisma.restaurantPost.deleteMany({ where: { id: { startsWith: "demo-p" } } });
  await prisma.restaurant.deleteMany({ where: { id: { startsWith: "demo-r" } } });
  await prisma.userRegionStat.deleteMany({ where: { userId: { startsWith: "demo-u" } } });
  await prisma.user.deleteMany({ where: { id: { startsWith: "demo-u" } } });
}

export async function runDemoSeed() {
  const seoul = await prisma.region.findFirst({ where: { name: "서울" }, select: { id: true } });
  if (!seoul) throw new Error("서울 지역이 없습니다. 먼저 기본 시드를 실행하세요.");
  const regionId = seoul.id;
  const now = new Date();

  // 1) 유저 + 지역 스탯
  await Promise.all(
    FOODIES.map(async (f, i) => {
      const id = `demo-u${i + 1}`;
      const base = {
        nickname: f.n,
        avatarUrl: `https://i.pravatar.cc/200?img=${f.av}`,
        totalLevel: f.lv,
        totalXp: f.xp,
        isAdmin: false,
        deactivatedAt: null,
        nicknameConfirmedAt: now,
        emailVerifiedAt: now,
      };
      await prisma.user.upsert({
        where: { id },
        update: base,
        create: { id, email: `${id}@mukgopin.demo`, passwordHash: "demo-no-login", ...base },
      });
      await prisma.userRegionStat.upsert({
        where: { userId_regionId: { userId: id, regionId } },
        update: { regionLevel: Math.max(1, Math.round(f.lv * 0.6)), regionXp: Math.round(f.xp * 0.5), restaurantCount: 3 },
        create: { userId: id, regionId, regionLevel: Math.max(1, Math.round(f.lv * 0.6)), regionXp: Math.round(f.xp * 0.5), restaurantCount: 3 },
      });
    })
  );

  // 2) 상위 6명에게 맛집 3곳씩 (맛집+글+사진)
  for (let u = 0; u < 6; u++) {
    const userId = `demo-u${u + 1}`;
    await Promise.all(
      [0, 1, 2].map(async (j) => {
        const spot = SPOTS[(u * 3 + j) % SPOTS.length];
        const rid = `demo-r-${u + 1}-${j + 1}`;
        const pid = `demo-p-${u + 1}-${j + 1}`;
        await prisma.restaurant.upsert({
          where: { id: rid },
          update: { name: spot.name },
          create: {
            id: rid,
            name: spot.name,
            primaryRegionId: regionId,
            createdByUserId: userId,
            address: "서울특별시",
            latitude: 37.55 + (j + u) * 0.004,
            longitude: 126.97 + (j + u) * 0.004,
            saveCount: 20 + j * 13,
          },
        });
        await prisma.restaurantPost.upsert({
          where: { id: pid },
          update: { shortReview: spot.short },
          create: {
            id: pid,
            restaurantId: rid,
            userId,
            shortReview: spot.short,
            atmosphereTags: spot.tags,
            priceRange: spot.price,
            likeCount: 12 + j * 9,
            saveCount: 20 + j * 11,
            locationVerified: true,
            visitedAt: now,
          },
        });
        await prisma.media.upsert({
          where: { id: `demo-m-${u + 1}-${j + 1}` },
          update: { url: img(pid) },
          create: { id: `demo-m-${u + 1}-${j + 1}`, postId: pid, type: "image", url: img(pid), sortOrder: 0 },
        });
      })
    );
  }

  // 3) 상위 3명에게 유료 지도 1개씩 (맛보기 2곳 공개)
  const MAPS = [
    { title: "강남 데이트 끝판왕 맛집 지도", price: 4900 },
    { title: "성수 핫플 큐레이션", price: 2900 },
    { title: "홍대 혼밥 성지 모음", price: 2900 },
  ];
  for (let u = 0; u < 3; u++) {
    const userId = `demo-u${u + 1}`;
    const cid = `demo-c-${u + 1}`;
    await prisma.collection.upsert({
      where: { id: cid },
      update: { title: MAPS[u].title, isPaid: true, priceWon: MAPS[u].price, isPublic: true },
      create: { id: cid, userId, title: MAPS[u].title, description: "검증된 미식가의 인증 맛집 모음", regionId, isPaid: true, priceWon: MAPS[u].price, isPublic: true },
    });
    await Promise.all(
      [0, 1, 2].map((j) =>
        prisma.collectionItem.upsert({
          where: { id: `demo-ci-${u + 1}-${j + 1}` },
          update: {},
          create: { id: `demo-ci-${u + 1}-${j + 1}`, collectionId: cid, restaurantId: `demo-r-${u + 1}-${j + 1}`, postId: `demo-p-${u + 1}-${j + 1}`, isPreview: j < 2, sortOrder: j },
        })
      )
    );
  }

  const [users, posts, maps] = await Promise.all([
    prisma.user.count({ where: { id: { startsWith: "demo-u" } } }),
    prisma.restaurantPost.count({ where: { id: { startsWith: "demo-p" } } }),
    prisma.collection.count({ where: { id: { startsWith: "demo-c" } } }),
  ]);
  return { users, posts, maps };
}
