/**
 * 자동 스크린샷 QA — 주요 화면을 모바일 사이즈로 캡처.
 * 실행:  npm run screenshots
 *   - 기본 대상: http://localhost:3000 (로컬 서버 켜져 있어야 함)
 *   - 배포본 대상:  SCREENSHOT_BASE_URL=https://matzip-psi-nine.vercel.app npm run screenshots
 *   - 로그인 화면도 찍으려면: SCREENSHOT_EMAIL=... SCREENSHOT_PASSWORD=... (없으면 비로그인 캡처)
 * 결과: artifacts/screenshots/YYYY-MM-DD-HH-mm/<page>-<width>.png
 */
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { join } from "path";

const BASE = (process.env.SCREENSHOT_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const EMAIL = process.env.SCREENSHOT_EMAIL;
const PASSWORD = process.env.SCREENSHOT_PASSWORD;

const VIEWPORTS = [390, 430]; // iPhone 12~15 / Pro Max 폭
const VH: Record<number, number> = { 390: 844, 430: 932 };

const PAGES: { name: string; path: string }[] = [
  { name: "home", path: "/" },
  { name: "benefits", path: "/benefits" },
  { name: "search", path: "/search" },
  { name: "nearby", path: "/nearby" },
  { name: "rankings", path: "/rankings" },
  { name: "me", path: "/me" },
  { name: "register", path: "/register" },
];

function stamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}-${p(d.getMinutes())}`;
}

async function main() {
  const outDir = join("artifacts", "screenshots", stamp());
  mkdirSync(outDir, { recursive: true });
  console.log(`대상: ${BASE}`);

  const browser = await chromium.launch();
  const failures: string[] = [];
  try {
    const context = await browser.newContext();
    // 스플래시는 캡처 방해 → 모든 페이지에서 건너뛰기 (실유저는 1회 정상 노출)
    await context.addInitScript(() => {
      try {
        sessionStorage.setItem("mukgopin-splash-seen", "1");
      } catch {}
    });

    // (선택) 로그인 — 계정 정보 있으면. 성공/실패를 명확히 보고.
    if (EMAIL && PASSWORD) {
      try {
        const p = await context.newPage();
        await p.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
        await p.fill('input[name="email"]', EMAIL);
        await p.fill('input[name="password"]', PASSWORD);
        await p.click('button[type="submit"]');
        await p.waitForTimeout(2500);
        if (p.url().includes("/login")) {
          const err = await p.textContent(".text-red-500").catch(() => null);
          console.log(`⚠️ 로그인 실패: ${err?.trim() || "이메일/비밀번호 확인 필요"} — 비로그인으로 진행`);
        } else {
          console.log("✓ 로그인 성공");
        }
        await p.close();
      } catch (e) {
        console.log("⚠️ 로그인 시도 오류 — 비로그인으로 진행:", e instanceof Error ? e.message : e);
      }
    } else {
      console.log("ℹ️ SCREENSHOT_EMAIL/PASSWORD 없음 — 비로그인 캡처 (/me, /register는 로그인 화면)");
    }

    // 홈에서 맛집 상세 샘플 1개 찾기
    const targets = [...PAGES];
    try {
      const p = await context.newPage();
      await p.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 30000 });
      const href = await p.getAttribute('a[href^="/restaurants/"]', "href").catch(() => null);
      if (href) targets.push({ name: "detail", path: href });
      await p.close();
    } catch {}

    for (const w of VIEWPORTS) {
      const page = await context.newPage();
      await page.setViewportSize({ width: w, height: VH[w] ?? 844 });
      for (const t of targets) {
        try {
          await page.goto(`${BASE}${t.path}`, { waitUntil: "networkidle", timeout: 30000 });
          await page.waitForTimeout(900);

          if (t.name === "detail") {
            // 상세는 스크롤 위치별 3장 (top / mid / bottom) — viewport 기준
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.waitForTimeout(300);
            await page.screenshot({ path: join(outDir, `detail-top-${w}.png`) });
            await page.evaluate(() => window.scrollTo(0, 700));
            await page.waitForTimeout(300);
            await page.screenshot({ path: join(outDir, `detail-mid-${w}.png`) });
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page.waitForTimeout(300);
            await page.screenshot({ path: join(outDir, `detail-bottom-${w}.png`) });
            console.log(`✓ detail-(top/mid/bottom)-${w}`);
          } else {
            // 나머지는 viewport(보이는 영역) + full(전체) 둘 다
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.screenshot({ path: join(outDir, `${t.name}-${w}-view.png`) });
            await page.screenshot({ path: join(outDir, `${t.name}-${w}-full.png`), fullPage: true });
            console.log(`✓ ${t.name}-${w} (view+full)`);
          }
        } catch (e) {
          failures.push(`${t.name}-${w}: ${e instanceof Error ? e.message : e}`);
          console.log(`✗ ${t.name}-${w} 실패`);
        }
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }

  console.log(`\n📸 저장 위치: ${outDir}`);
  if (failures.length) {
    console.log(`⚠️ 실패 ${failures.length}개:`);
    failures.forEach((f) => console.log("  - " + f));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
