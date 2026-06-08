/**
 * API 스모크 — HTTP 라우트 회귀 (smoke.ts 는 서비스 직접 호출이라 라우트 우회를 못 잡음).
 * 실행: 서버를 먼저 띄운 뒤 `npm run smoke:api` (기본 http://localhost:3000, SMOKE_BASE_URL 로 변경).
 * 비변경 테스트만 수행(데이터 안 건드림). 영수증 케이스는 AI 1회 호출이 날 수 있음.
 */
import { prisma } from "../src/lib/db";
import { createHmac } from "crypto";

const BASE = process.env.SMOKE_BASE_URL || "http://localhost:3000";

function token(uid: string): string {
  const s = process.env.AUTH_SECRET ?? "dev-only-secret";
  return `${uid}.${createHmac("sha256", s).update(uid).digest("base64url")}`;
}
function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("ASSERT FAILED: " + msg);
  console.log("  ✓ " + msg);
}

async function main() {
  // 서버 살아있는지
  try {
    await fetch(BASE, { signal: AbortSignal.timeout(5000) });
  } catch {
    console.error(`❌ 서버가 ${BASE} 에 없어요. 먼저 'npm run start' (또는 dev) 로 띄우세요.`);
    process.exit(1);
  }

  const lee = await prisma.user.findUnique({ where: { email: "lee@lee.com" }, select: { id: true } });
  const post = lee
    ? await prisma.restaurantPost.findFirst({ where: { userId: lee.id, locationVerified: true }, select: { id: true } })
    : null;
  if (!lee || !post) {
    console.error("❌ 고정 계정(lee@lee.com)의 인증된 글이 없어요. 먼저 만들어 주세요.");
    process.exit(1);
  }
  const H = { "Content-Type": "application/json", Cookie: `matzip_session=${token(lee.id)}` };

  console.log("[API] /verify 로는 증거를 못 붙임 (AI/카메라 검증 우회 차단)");
  let r = await fetch(`${BASE}/api/posts/${post.id}/verify`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ type: "photo", url: "data:image/jpeg;base64,AAAA" }),
  });
  let d = await r.json();
  assert(r.status === 400 && d.error === "BAD_TYPE", "/verify 의 photo 타입은 BAD_TYPE 으로 거부");

  console.log("[API] /proof 영수증 — 가짜 이미지는 거부 (fail-closed / 영수증 아님)");
  r = await fetch(`${BASE}/api/posts/${post.id}/proof`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ kind: "receipt", image: "data:image/jpeg;base64,AAAA" }),
  });
  d = await r.json();
  assert(d.ok === false, "/proof 영수증 가짜이미지 → ok:false");

  console.log("[API] /proof 인증 필요");
  r = await fetch(`${BASE}/api/posts/${post.id}/proof`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "photo", image: "data:image/jpeg;base64,AAAA" }),
  });
  assert(r.status === 401, "/proof 비로그인 → 401 UNAUTHORIZED");

  console.log("[API] /proof 이미지 크기 상한 (AI 호출 전 차단)");
  const huge = "data:image/jpeg;base64," + "A".repeat(1_100_000); // 상한(1,000,000) 초과
  r = await fetch(`${BASE}/api/posts/${post.id}/proof`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ kind: "photo", image: huge }),
  });
  d = await r.json();
  assert(r.status === 413 && d.ok === false, "/proof 과대 이미지 → 413 거부 (AI 호출 안 함)");

  console.log("[API] 로컬 업로드 서빙 — 경로 이탈 차단");
  r = await fetch(`${BASE}/api/uploads/%2e%2e%2f%2e%2e%2fpackage.json`, { headers: H });
  assert(r.status === 403 || r.status === 404, "/api/uploads 인코딩된 ../ 경로 이탈 → 차단(403/404)");

  // 멱등: 이 테스트가 남긴 시도 기록 정리 (반복 실행 시 슬롯 상한 안 차게)
  await prisma.proofAttempt.deleteMany({ where: { postId: post.id } });

  console.log("\n✅ API 스모크 통과");
}

main()
  .catch((e) => {
    console.error("\n❌", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
