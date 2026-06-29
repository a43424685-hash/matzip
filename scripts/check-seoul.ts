/**
 * 진단용 — 운영자(시드) 맛집이 검색/지도에 안 뜨는 이유를 데이터에서 확인.
 * 실행: npx tsx scripts/check-seoul.ts
 * 아무것도 바꾸지 않음(읽기만).
 */
import { prisma } from "../src/lib/db";

const OPERATOR_EMAIL = "zzllaa7788@daum.net";

async function main() {
  const op = await prisma.user.findUnique({
    where: { email: OPERATOR_EMAIL },
    select: { id: true, nickname: true, isAdmin: true, deactivatedAt: true },
  });
  console.log("── 운영자 계정 ──");
  console.log(op ?? "❌ 운영자 계정 없음!");
  if (!op) return;

  const total = await prisma.restaurantPost.count({ where: { userId: op.id } });
  const verified = await prisma.restaurantPost.count({ where: { userId: op.id, locationVerified: true } });
  const pub = await prisma.restaurantPost.count({ where: { userId: op.id, visibility: "public" } });
  const priv = await prisma.restaurantPost.count({ where: { userId: op.id, visibility: "private" } });
  const noCoord = await prisma.restaurantPost.count({
    where: { userId: op.id, restaurant: { is: { latitude: null } } },
  });

  console.log("\n── 운영자 맛집 글 요약 ──");
  console.log({ 전체: total, 위치인증됨: verified, 공개: pub, 나만보관: priv, 좌표없음: noCoord });

  // 검색/지도 노출 조건(공개 + (인증 or 운영자))을 통과하는 글 수
  const visibleInSearch = await prisma.restaurantPost.count({
    where: {
      userId: op.id,
      visibility: "public",
      OR: [{ locationVerified: true }, { user: { is: { isAdmin: true } } }],
    },
  });
  console.log(`\n검색/지도에 뜰 수 있는 운영자 글: ${visibleInSearch} / ${total}`);

  console.log("\n── 샘플 8개 ──");
  const sample = await prisma.restaurantPost.findMany({
    where: { userId: op.id },
    take: 8,
    orderBy: { createdAt: "desc" },
    select: {
      locationVerified: true,
      visibility: true,
      restaurant: {
        select: { name: true, latitude: true, longitude: true, primaryRegion: { select: { name: true } } },
      },
    },
  });
  for (const p of sample) {
    console.log(
      `${p.restaurant.name} | 인증:${p.locationVerified} | 공개:${p.visibility} | 좌표:${p.restaurant.latitude},${p.restaurant.longitude} | 지역:${p.restaurant.primaryRegion?.name}`
    );
  }

  // "강남" 이름/주소 포함 글이 실제로 있는지
  const gangnam = await prisma.restaurantPost.count({
    where: {
      userId: op.id,
      restaurant: { is: { OR: [{ name: { contains: "강남" } }, { address: { contains: "강남" } }] } },
    },
  });
  console.log(`\n이름/주소에 '강남' 포함된 운영자 맛집: ${gangnam}개`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
