/**
 * 이미 등록된 모든 공개 맛집 글에 '날씨/계절' 태그 백필 (음식 카테고리·대표메뉴 휴리스틱).
 * 이미 날씨 태그가 있는 글은 건너뜀. 명확한 신호가 없으면 태그 안 붙임(맑음 남발 방지).
 *   node --env-file=.env.prod.local scripts/backfill-weather-tags.mjs [--write]
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const WRITE = process.argv.includes("--write");

const HOT = ["냉면", "막국수", "빙수", "물회", "소바", "밀면"];
const SOUP = ["국밥", "곰탕", "순대", "칼국수", "국수", "우동", "짬뽕", "전골", "찌개", "탕", "해장", "수제비", "라멘", "샤브"];
const SEASON_NAMES = new Set(["비 오는 날", "추운 날", "더운 날", "날씨 좋은 날", "봄 시즌", "여름 계절메뉴", "가을 분위기", "겨울 국물"]);

// menu(대표메뉴, 없을 수 있음) + cats(현재 카테고리명들) → 날씨 태그. 신호 없으면 [].
function seasonsFor(menu, cats) {
  const m = menu || "";
  const s = new Set();
  const has = (arr) => arr.some((k) => m.includes(k));
  if (has(HOT) || cats.includes("회/해산물")) s.add("더운 날");
  if (has(SOUP) || cats.includes("국밥/탕")) { s.add("비 오는 날"); s.add("추운 날"); s.add("겨울 국물"); }
  if (cats.includes("카페") || cats.includes("디저트") || cats.includes("베이커리")) { s.add("날씨 좋은 날"); s.add("더운 날"); }
  if (cats.includes("바/와인") || m.includes("술") || m.includes("포차") || m.includes("전")) s.add("비 오는 날");
  return [...s]; // 명확한 신호 없으면 빈 배열 → 태깅 안 함
}

async function main() {
  const seasonCats = await prisma.category.findMany({ where: { type: "season" }, select: { id: true, name: true } });
  const idByName = new Map(seasonCats.map((c) => [c.name, c.id]));

  const posts = await prisma.restaurantPost.findMany({
    where: { visibility: "public" },
    select: {
      id: true,
      restaurant: { select: { name: true, signatureMenu: true } },
      categories: { select: { category: { select: { name: true } } } },
    },
  });

  console.log(`${WRITE ? "🟢 쓰기" : "🔍 DRY-RUN"} — 공개 글 ${posts.length}개 검사\n`);
  let tagged = 0, added = 0, skipHasSeason = 0, skipNoSignal = 0;
  for (const p of posts) {
    const cur = p.categories.map((c) => c.category.name);
    if (cur.some((n) => SEASON_NAMES.has(n))) { skipHasSeason++; continue; } // 이미 날씨 태그 있음
    const seasons = seasonsFor(p.restaurant.signatureMenu, cur).filter((s) => idByName.has(s));
    if (seasons.length === 0) { skipNoSignal++; continue; }
    tagged++;
    if (tagged <= 25) console.log(`  ${p.restaurant.name} [${cur.join(",") || "-"}] → +[${seasons.join(", ")}]`);
    if (WRITE) {
      await prisma.restaurantPostCategory.createMany({
        data: seasons.map((s) => ({ postId: p.id, categoryId: idByName.get(s) })),
        skipDuplicates: true,
      });
      added += seasons.length;
    }
  }
  console.log(`\n태깅 대상 ${tagged}개${WRITE ? ` · 태그 ${added}개 추가` : " (DRY-RUN)"} / 이미있음 ${skipHasSeason} · 신호없음(건너뜀) ${skipNoSignal}`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
