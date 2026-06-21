/**
 * 스크롤 QA — 내부 이동 시 새 화면이 top에서 시작하는지 + 뒤로가기는 복원되는지.
 * 실행: (로컬 서버 켠 뒤) npm run scroll-qa
 *   기본 대상 http://localhost:3000, SCROLL_QA_BASE_URL로 변경 가능.
 * WebKit(사파리 엔진)으로 검증 — iOS와 가장 가깝다.
 */
import { webkit, type Page } from "playwright";

const BASE = (process.env.SCROLL_QA_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const TOP = 5; // 이 값 이하면 'top'
const results: { name: string; pass: boolean; detail: string }[] = [];

async function firstRestaurantHref(page: Page): Promise<string | null> {
  return page.getAttribute('a[href^="/restaurants/"]', "href").catch(() => null);
}

async function run() {
  const browser = await webkit.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => {
    try {
      sessionStorage.setItem("mukgopin-splash-seen", "1");
    } catch {}
  });
  const page = await ctx.newPage();

  async function scrollDown(px = 800) {
    await page.evaluate((y) => window.scrollTo(0, y), px);
    await page.waitForTimeout(250);
  }
  const y = () => page.evaluate(() => window.scrollY);

  // 1) 홈 아래 스크롤 → 맛집 클릭 → 상세 top
  try {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    await scrollDown(1000);
    const before = await y();
    const href = await firstRestaurantHref(page);
    await page.click(`a[href="${href}"]`);
    await page.waitForTimeout(1400);
    const after = await y();
    results.push({ name: "홈→맛집 상세", pass: after <= TOP, detail: `홈 ${before}→상세 ${after}` });

    // 2) 상세에서 뒤로가기 → 홈 스크롤 복원(top 아님)
    await page.goBack();
    await page.waitForTimeout(1400);
    const back = await y();
    // 핵심: 뒤로가기는 top으로 '강제'되면 안 됨(브라우저 복원 허용). 0 근처가 아니면 통과.
    results.push({ name: "상세→뒤로(복원)", pass: back > TOP, detail: `복원 ${back} (top강제 아님=정상, 0이면 버그)` });
  } catch (e) {
    results.push({ name: "홈→맛집/뒤로", pass: false, detail: String(e instanceof Error ? e.message : e) });
  }

  // 3) 검색 결과 아래 스크롤 → 맛집 클릭 → 상세 top
  try {
    await page.goto(`${BASE}/search`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    await scrollDown(900);
    const href = await firstRestaurantHref(page);
    if (href) {
      await page.click(`a[href="${href}"]`);
      await page.waitForTimeout(1400);
      const after = await y();
      results.push({ name: "검색→맛집 상세", pass: after <= TOP, detail: `상세 ${after}` });
    } else {
      results.push({ name: "검색→맛집 상세", pass: false, detail: "검색 결과 없음(데이터 부족)" });
    }
  } catch (e) {
    results.push({ name: "검색→맛집 상세", pass: false, detail: String(e instanceof Error ? e.message : e) });
  }

  // 4) 주변 바텀시트 → 맛집 클릭 → 상세 top
  try {
    await page.goto(`${BASE}/nearby`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    const href = await firstRestaurantHref(page);
    if (href) {
      await page.click(`a[href="${href}"]`);
      await page.waitForTimeout(1400);
      const after = await y();
      results.push({ name: "주변→맛집 상세", pass: after <= TOP, detail: `상세 ${after}` });
    } else {
      results.push({ name: "주변→맛집 상세", pass: false, detail: "주변 목록 없음(위치/데이터)" });
    }
  } catch (e) {
    results.push({ name: "주변→맛집 상세", pass: false, detail: String(e instanceof Error ? e.message : e) });
  }

  // 5) 랭킹 탭/필터 전환 → top(또는 위치 유지 안 함)
  try {
    await page.goto(`${BASE}/rankings`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    await scrollDown(700);
    const regionTab = await page.getAttribute('a[href*="tab=region"]', "href").catch(() => null);
    if (regionTab) {
      await page.click(`a[href="${regionTab}"]`);
      await page.waitForTimeout(1200);
      const after = await y();
      results.push({ name: "랭킹 탭 전환", pass: after <= TOP, detail: `전환 후 ${after}` });
    } else {
      results.push({ name: "랭킹 탭 전환", pass: true, detail: "탭이 링크형 아님 — 스킵" });
    }
  } catch (e) {
    results.push({ name: "랭킹 탭 전환", pass: false, detail: String(e instanceof Error ? e.message : e) });
  }

  await browser.close();

  console.log("\n=== 스크롤 QA 결과 ===");
  let allPass = true;
  for (const r of results) {
    if (!r.pass) allPass = false;
    console.log(`${r.pass ? "✅" : "❌"}  ${r.name.padEnd(20)} ${r.detail}`);
  }
  console.log(`\n${allPass ? "🟢 전체 통과" : "🔴 실패 케이스 있음"}`);
  process.exit(allPass ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
