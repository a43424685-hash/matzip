/**
 * 인증메일 발송 테스트.
 * 실행: $env:RESEND_API_KEY="..."; npx tsx scripts/test-email.ts <받는이메일>
 */
import { sendVerificationEmail } from "../src/lib/email";

async function main() {
  const to = process.argv[2];
  if (!to) throw new Error("사용법: npx tsx scripts/test-email.ts <email>");
  const base = process.env.APP_URL || "https://matzip-psi-nine.vercel.app";
  const url = `${base.replace(/\/$/, "")}/verify-email?token=TEST_SAMPLE_TOKEN`;
  console.log(`보내는 중 → ${to} (from ${process.env.EMAIL_FROM || "먹고핀 <onboarding@resend.dev>"})`);
  await sendVerificationEmail(to, url);
  console.log("완료 (RESEND_API_KEY 있으면 실제 발송, 없으면 콘솔 폴백)");
}

main().catch((e) => {
  console.error("발송 오류:", e);
  process.exit(1);
});
