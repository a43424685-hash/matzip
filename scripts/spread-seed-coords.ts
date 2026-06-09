/**
 * 기존 시드(운영자 유료 지도)의 맛집 좌표가 한 점에 겹쳐 있어, 지도 핀이 흩어지도록 보정.
 * 컬렉션을 지우지 않으므로 기존 구매 기록은 유지됨.
 * 실행: npx tsx scripts/spread-seed-coords.ts
 */
import { prisma } from "../src/lib/db";

const OPERATOR_EMAIL = "zzllaa7788@daum.net";
const REGION_BASE: Record<string, { lat: number; lng: number }> = {
  서울: { lat: 37.5665, lng: 126.978 },
  부산: { lat: 35.1796, lng: 129.0756 },
};
function spreadCoord(region: string, idx: number) {
  const base = REGION_BASE[region] ?? REGION_BASE["서울"];
  return {
    lat: base.lat + ((idx % 3) - 1) * 0.008 + Math.floor(idx / 3) * 0.006,
    lng: base.lng + (((idx + 1) % 3) - 1) * 0.009,
  };
}

async function main() {
  const op = await prisma.user.findUnique({ where: { email: OPERATOR_EMAIL }, select: { id: true } });
  if (!op) throw new Error("운영자 계정 없음");

  const cols = await prisma.collection.findMany({
    where: { userId: op.id, isPaid: true },
    select: {
      id: true,
      title: true,
      region: { select: { name: true } },
      items: {
        orderBy: { sortOrder: "asc" },
        select: { restaurant: { select: { id: true, name: true } } },
      },
    },
  });

  let updated = 0;
  for (const col of cols) {
    let idx = 0;
    for (const it of col.items) {
      const { lat, lng } = spreadCoord(col.region.name, idx++);
      await prisma.restaurant.update({
        where: { id: it.restaurant.id },
        data: { latitude: lat, longitude: lng },
      });
      updated++;
    }
    console.log(`  ✓ ${col.title} — ${col.items.length}곳 좌표 분산`);
  }
  console.log(`\n✅ 좌표 보정 완료 — 맛집 ${updated}곳`);
}

main().finally(() => prisma.$disconnect());
