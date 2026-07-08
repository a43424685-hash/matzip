/**
 * 다이닝코드 ∩ 카카오 겹치는 맛집 수집 → 운영자 PICK 등록/보강.
 *
 * 신뢰도: 다이닝코드(맛집 큐레이션) + 카카오(장소 실재) 양쪽에 다 있는 곳만 채택.
 * 저작권 안전: 외부 '사진'은 절대 저장 안 함. 텍스트 지표(대표메뉴/별점/리뷰수/지수)만.
 *
 * 사용:
 *   node --env-file=.env.prod.local scripts/collect-diningcode-kakao.mjs 수유 창동        # 미리보기(쓰기 X)
 *   node --env-file=.env.prod.local scripts/collect-diningcode-kakao.mjs 수유 창동 --write # 실제 등록
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;

const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const areas = args.filter((a) => !a.startsWith("--"));
const AREAS = areas.length ? areas : ["수유", "창동"];
const PER_AREA = 15; // 지역당 상위 N개만
const MATCH_DIST_M = 160; // 다이닝코드↔카카오 좌표 이 거리 이내면 동일 장소

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => (s || "").replace(/\s+/g, "").toLowerCase();
const isChain = (nm) => /(\d+호점|점)$/.test((nm || "").trim());

function distM(aLat, aLng, bLat, bLng) {
  const R = 6371000, d = Math.PI / 180;
  const dLat = (bLat - aLat) * d, dLng = (bLng - aLng) * d;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * d) * Math.cos(bLat * d) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

const PROV = { 서울: "서울", 부산: "부산", 대구: "대구", 인천: "인천", 광주: "광주", 대전: "대전", 울산: "울산", 세종: "세종", 경기: "경기", 강원: "강원", 충북: "충북", 충남: "충남", 전북: "전북", 전남: "전남", 경북: "경북", 경남: "경남", 제주: "제주", 충청북: "충북", 충청남: "충남", 전라북: "전북", 전라남: "전남", 경상북: "경북", 경상남: "경남" };
function provinceFromAddr(addr) {
  const head = (addr || "").trim().split(/\s+/)[0] ?? "";
  const n = head.replace(/특별자치도|특별자치시|특별시|광역시|자치도|자치시/g, "").replace(/도$|시$/, "");
  return PROV[n] ?? PROV[head] ?? null;
}
// 다이닝코드 category("칼국수, 들깨칼국수") → 대표메뉴(가장 구체적=가장 긴 토큰)
function signatureFromCategory(cat) {
  const toks = (cat || "").split(/[,/]/).map((s) => s.trim()).filter(Boolean);
  if (!toks.length) return null;
  return toks.sort((a, b) => b.length - a.length)[0];
}
// 앱 음식 카테고리 매핑 (간이)
const FOOD_RULES = [
  ["국밥/탕", ["국밥", "탕", "설렁탕", "곰탕", "해장국", "감자탕"]],
  ["회/해산물", ["회", "해산물", "해물", "조개", "굴", "활어", "장어", "물회"]],
  ["일식", ["스시", "초밥", "라멘", "돈카츠", "돈가스", "이자카야", "우동", "오마카세"]],
  ["고기", ["고기", "구이", "삼겹", "갈비", "곱창", "막창", "족발", "닭갈비", "불고기"]],
  ["중식", ["중식", "중국", "짜장", "짬뽕", "마라", "딤섬"]],
  ["양식", ["파스타", "피자", "스테이크", "이탈리", "브런치", "버거"]],
  ["분식", ["분식", "떡볶이", "김밥", "튀김"]],
  ["면", ["칼국수", "국수", "냉면", "막국수", "소바", "면"]],
  ["베이커리", ["베이커리", "빵", "제과", "베이글"]],
  ["디저트", ["디저트", "케이크", "빙수", "아이스크림", "와플"]],
  ["카페", ["카페", "커피", "티룸"]],
  ["바/와인", ["와인", "위스키", "칵테일", "술집", "주점", "호프", "포차", "펍", "맥주"]],
  ["한식", ["한식", "백반", "한정식", "찌개", "보쌈", "비빔밥", "전"]],
];
function foodCategory(cat) {
  const c = (cat || "").toLowerCase();
  for (const [name, keys] of FOOD_RULES) if (keys.some((k) => c.includes(k))) return name;
  return null;
}

// 대표메뉴·음식종류 → 어울리는 날씨 태그 (backfill-weather-tags.mjs와 동일 휴리스틱)
const _HOT = ["냉면", "막국수", "빙수", "물회", "소바", "밀면"];
const _SOUP = ["국밥", "곰탕", "순대", "칼국수", "국수", "우동", "짬뽕", "전골", "찌개", "탕", "해장", "수제비", "라멘", "샤브"];
function weatherTags(menu, foodCat) {
  const m = menu || "";
  const s = new Set();
  const has = (arr) => arr.some((k) => m.includes(k));
  if (has(_HOT) || foodCat === "회/해산물") s.add("더운 날");
  if (has(_SOUP) || foodCat === "국밥/탕") { s.add("비 오는 날"); s.add("추운 날"); s.add("겨울 국물"); }
  if (foodCat === "카페" || foodCat === "디저트" || foodCat === "베이커리") { s.add("날씨 좋은 날"); s.add("더운 날"); }
  if (foodCat === "바/와인" || m.includes("술") || m.includes("포차") || m.includes("전")) s.add("비 오는 날");
  return [...s];
}

async function fetchDiningcode(area) {
  const body = new URLSearchParams({ query: `${area} 맛집`, order: "r_score", page: "1", size: String(PER_AREA) });
  const res = await fetch("https://im.diningcode.com/API/isearch/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      Referer: "https://www.diningcode.com/",
    },
    body: body.toString(),
  });
  if (!res.ok) return [];
  const j = await res.json().catch(() => ({}));
  return j?.result_data?.poi_section?.list || j?.poi_section?.list || [];
}

async function kakaoMatch(name, dLat, dLng) {
  if (!KAKAO_KEY) return null;
  const url = "https://dapi.kakao.com/v2/local/search/keyword.json?" + new URLSearchParams({ query: name, size: "10" });
  const res = await fetch(url, { headers: { Authorization: `KakaoAK ${KAKAO_KEY}` } });
  if (!res.ok) return null;
  const docs = (await res.json().catch(() => ({})))?.documents ?? [];
  const nn = norm(name);
  for (const d of docs) {
    const kLat = Number(d.y), kLng = Number(d.x);
    const nameHit = norm(d.place_name).includes(nn) || nn.includes(norm(d.place_name));
    const near = dLat && dLng ? distM(dLat, dLng, kLat, kLng) <= MATCH_DIST_M : true;
    if (nameHit && near) {
      return { kakaoPlaceId: d.id, name: d.place_name, address: d.road_address_name || d.address_name || "", lat: kLat, lng: kLng, category: d.category_name || "" };
    }
  }
  return null;
}

async function main() {
  console.log(`\n${WRITE ? "🟢 실제 등록 모드" : "🔍 미리보기(DRY-RUN, 쓰기 없음)"} — 지역: ${AREAS.join(", ")}\n`);
  if (!KAKAO_KEY) { console.log("❌ KAKAO_REST_API_KEY 없음"); return; }

  const operator = await prisma.user.findFirst({ where: { isAdmin: true }, select: { id: true, nickname: true } });
  if (!operator) { console.log("❌ 운영자(admin) 계정 없음"); return; }
  const regions = await prisma.region.findMany({ select: { id: true, name: true } });
  const regionByName = new Map(regions.map((r) => [r.name, r.id]));
  const seasonCats = await prisma.category.findMany({ where: { type: "season" }, select: { id: true, name: true } });
  const seasonIdByName = new Map(seasonCats.map((c) => [c.name, c.id]));

  let matched = 0, created = 0, updated = 0, skipped = 0;
  const seen = new Set();

  for (const area of AREAS) {
    const list = await fetchDiningcode(area);
    console.log(`\n【${area}】 다이닝코드 ${list.length}곳 조회`);
    for (const p of list) {
      if (isChain(p.nm)) { skipped++; continue; }
      const dLat = Number(p.lat), dLng = Number(p.lng);
      await sleep(120); // 카카오 rate 배려
      const k = await kakaoMatch(p.nm, dLat, dLng);
      if (!k || !k.kakaoPlaceId) { skipped++; continue; }
      if (seen.has(k.kakaoPlaceId)) continue;
      seen.add(k.kakaoPlaceId);
      matched++;

      const addr = k.address || p.road_addr || p.addr || "";
      const prov = provinceFromAddr(addr);
      const regionId = prov ? regionByName.get(prov) : null;
      const sig = signatureFromCategory(p.category);
      const foodCat = foodCategory(p.category);
      const ext = {
        signatureMenu: sig,
        extRating: p.user_score != null ? Number(p.user_score) : null,
        extReviewCount: p.review_cnt != null ? Number(p.review_cnt) : null,
        extScore: p.score != null ? Number(p.score) : null,
        extSource: "diningcode∩kakao",
        extSyncedAt: new Date(),
      };

      console.log(
        `  ✓ ${p.nm}  ⭐${ext.extRating ?? "-"} (리뷰 ${ext.extReviewCount ?? 0}) 지수 ${ext.extScore ?? "-"}` +
        ` · 대표메뉴 "${sig ?? "-"}" · ${foodCat ?? "?"} · ${prov ?? "지역?"} · kakao=${k.kakaoPlaceId}`
      );

      if (!WRITE) continue;
      if (!regionId) { console.log(`    ⚠ 지역 매칭 실패 → 건너뜀`); continue; }

      // Restaurant upsert (kakaoPlaceId 기준)
      const existing = await prisma.restaurant.findUnique({ where: { kakaoPlaceId: k.kakaoPlaceId }, select: { id: true } });
      const rest = existing
        ? await prisma.restaurant.update({ where: { id: existing.id }, data: { ...ext, address: addr, latitude: k.lat, longitude: k.lng } })
        : await prisma.restaurant.create({
            data: { name: p.nm, kakaoPlaceId: k.kakaoPlaceId, address: addr, latitude: k.lat, longitude: k.lng, primaryRegionId: regionId, createdByUserId: operator.id, ...ext },
          });
      if (existing) updated++; else created++;

      // 운영자 PICK 글이 아직 없으면 생성
      const post = await prisma.restaurantPost.findFirst({ where: { restaurantId: rest.id, userId: operator.id }, select: { id: true } });
      if (!post) {
        const np = await prisma.restaurantPost.create({
          data: { restaurantId: rest.id, userId: operator.id, isOperatorPick: true, visibility: "public", shortReview: null },
          select: { id: true },
        });
        if (foodCat) {
          const cat = await prisma.category.findUnique({ where: { name: foodCat }, select: { id: true } });
          if (cat) await prisma.restaurantPostCategory.create({ data: { postId: np.id, categoryId: cat.id } }).catch(() => {});
        }
        // 어울리는 날씨 태그 자동 부여 (날씨 추천용)
        const wtags = weatherTags(sig, foodCat).map((n) => seasonIdByName.get(n)).filter(Boolean);
        if (wtags.length) {
          await prisma.restaurantPostCategory.createMany({
            data: wtags.map((categoryId) => ({ postId: np.id, categoryId })),
            skipDuplicates: true,
          });
        }
      }
    }
  }

  console.log(`\n─────────────\n겹치는 맛집 ${matched}곳 · 건너뜀 ${skipped}${WRITE ? ` · 신규 ${created} · 보강 ${updated}` : " (DRY-RUN)"}\n`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
