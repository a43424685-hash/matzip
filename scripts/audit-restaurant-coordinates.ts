/**
 * 맛집 좌표 이상 감사 — 읽기 전용. DB를 수정하지 않는다.
 * 실행: npx tsx scripts/audit-restaurant-coordinates.ts
 * 잘못된 좌표(딴 동네에 찍힌 맛집 등)를 찾아 보고서를 출력한다.
 * 실제 수정은 이 결과를 사람이 검토·승인한 뒤 별도 스크립트로만 한다.
 */
import { PrismaClient } from "@prisma/client";
import { isValidLatLng, coordsPairConsistent, isWithinKorea } from "../src/lib/geoValidation";

const prisma = new PrismaClient();

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

async function main() {
  const rows = await prisma.restaurant.findMany({
    select: {
      id: true, name: true, address: true, latitude: true, longitude: true,
      primaryRegion: { select: { name: true } },
      collectionItems: { select: { collectionId: true } },
    },
  });

  const problems: { id: string; name: string; reason: string; lat: unknown; lng: unknown; region?: string }[] = [];

  // 1) 한쪽 좌표만 있음 / 범위 밖 / 한국 밖
  for (const r of rows) {
    const region = r.primaryRegion?.name;
    if (!coordsPairConsistent(r.latitude, r.longitude)) {
      problems.push({ id: r.id, name: r.name, reason: "좌표 한쪽만 있음", lat: r.latitude, lng: r.longitude, region });
      continue;
    }
    if (r.latitude == null) continue; // 둘 다 없음 = 위치 미등록(정상)
    if (!isValidLatLng(r.latitude, r.longitude)) {
      problems.push({ id: r.id, name: r.name, reason: "좌표 범위 이상(-90..90/-180..180 밖)", lat: r.latitude, lng: r.longitude, region });
      continue;
    }
    if (!isWithinKorea(r.latitude, r.longitude as number)) {
      problems.push({ id: r.id, name: r.name, reason: "한국 밖 좌표", lat: r.latitude, lng: r.longitude, region });
    }
  }

  // 2) 같은 컬렉션 중앙값에서 비정상적으로 먼 항목 (> 150km)
  const byCollection = new Map<string, { id: string; name: string; lat: number; lng: number }[]>();
  for (const r of rows) {
    if (r.latitude == null || r.longitude == null || !isValidLatLng(r.latitude, r.longitude)) continue;
    for (const ci of r.collectionItems) {
      const arr = byCollection.get(ci.collectionId) ?? [];
      arr.push({ id: r.id, name: r.name, lat: r.latitude, lng: r.longitude });
      byCollection.set(ci.collectionId, arr);
    }
  }
  const flaggedFar = new Set<string>();
  for (const [cid, arr] of byCollection) {
    if (arr.length < 4) continue;
    const mLat = median(arr.map((a) => a.lat));
    const mLng = median(arr.map((a) => a.lng));
    for (const a of arr) {
      const d = haversineMeters(a.lat, a.lng, mLat, mLng);
      if (d > 150000 && !flaggedFar.has(a.id)) {
        flaggedFar.add(a.id);
        problems.push({ id: a.id, name: a.name, reason: `컬렉션(${cid}) 중앙값에서 ${Math.round(d / 1000)}km 떨어짐`, lat: a.lat, lng: a.lng });
      }
    }
  }

  const total = rows.length;
  const withCoords = rows.filter((r) => r.latitude != null && r.longitude != null).length;
  console.log(`\n=== 맛집 좌표 감사 (읽기 전용) ===`);
  console.log(`전체 ${total}곳 · 좌표 있음 ${withCoords}곳 · 이상 후보 ${problems.length}건\n`);
  if (problems.length === 0) {
    console.log("✅ 이상 좌표 없음.");
  } else {
    for (const p of problems) {
      console.log(`- [${p.reason}] ${p.name} (${p.id})${p.region ? ` · ${p.region}` : ""} · lat=${p.lat} lng=${p.lng}`);
    }
    console.log(`\n※ 자동 수정하지 않았습니다. 위 ID를 검토·승인한 뒤 별도 스크립트로만 수정하세요.`);
  }
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
