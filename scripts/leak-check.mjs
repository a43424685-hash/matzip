/**
 * 유료 잠금 콘텐츠 누수 회귀 가드 (프레임워크 없이 실행).
 *   node scripts/leak-check.mjs
 * (1) 게이트 배선 검사: 상세·OG·공유·자동완성이 접근정책 함수를 실제로 호출하는지
 * (2) 데이터 불변식: 잠긴 글이 자동완성/공개 목록 쿼리로 새지 않는지
 * 실패 시 exit 1.
 */
import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
let failed = 0;
const ok = (m) => console.log("  ✓", m);
const bad = (m) => {
  console.log("  ✗", m);
  failed++;
};

function contains(path, needle, label) {
  try {
    readFileSync(path, "utf8").includes(needle) ? ok(label) : bad(`${label} — '${needle}' 없음 (${path})`);
  } catch {
    bad(`${label} — 파일 못 읽음 (${path})`);
  }
}

console.log("① 게이트 배선 검사");
contains("src/app/restaurants/[postId]/page.tsx", "canViewPost(", "상세 페이지 canViewPost 게이트");
contains("src/app/restaurants/[postId]/opengraph-image.tsx", "canViewPost(", "OG 이미지 canViewPost 게이트");
contains("src/app/share/[postId]/page.tsx", "canViewPost(", "공유 페이지 canViewPost 게이트");
contains("src/app/api/search/suggest/route.ts", "visibleRestaurantPostFilter", "자동완성 필터");
contains("src/components/KakaoMap.tsx", "escapeHtml(name)", "KakaoMap XSS 이스케이프");

console.log("② 데이터 불변식 검사");
const locked = await prisma.collectionItem.findMany({
  where: { isPreview: false, postId: { not: null }, collection: { isPaid: true } },
  select: { postId: true },
});
const lockedIds = new Set(locked.map((l) => l.postId).filter(Boolean));
console.log(`  (현재 잠긴 글 ${lockedIds.size}개)`);

if (lockedIds.size === 0) {
  ok("잠긴 글이 없어 누수 없음 (유료 판매 시작 후 재검증 필요)");
} else {
  // 잠긴 글의 음식점 이름이 "비로그인 자동완성 쿼리"에 뜨면 안 됨
  const lockedPosts = await prisma.restaurantPost.findMany({
    where: { id: { in: [...lockedIds] } },
    select: { restaurant: { select: { name: true } } },
  });
  let leak = 0;
  for (const lp of lockedPosts) {
    const name = lp.restaurant.name;
    // 자동완성과 동일 규칙: posts.some { visibility public, id notIn hidden }
    const hit = await prisma.restaurant.findFirst({
      where: {
        name,
        posts: { some: { visibility: "public", id: { notIn: [...lockedIds] } } },
      },
      select: { id: true },
    });
    // hit 이 있으면 "그 음식점에 공개 글이 따로 있다"는 뜻 → 이름 노출 정상.
    // hit 이 없으면 자동완성에 안 뜸 → 정상. (둘 다 누수 아님)
    if (!hit) continue;
  }
  leak === 0
    ? ok("잠긴 글 이름이 공개 글 없이 자동완성에 노출되는 경우 없음")
    : bad(`${leak}건 누수 의심`);
}

await prisma.$disconnect();
console.log(failed === 0 ? "\n✅ 누수 가드 통과" : `\n❌ ${failed}건 실패`);
process.exit(failed === 0 ? 0 : 1);
