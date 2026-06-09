/**
 * 특정 이메일 계정을 수동으로 이메일 인증 처리 (메일 발송 미구현 상태의 임시 운영용).
 * 실행: npx tsx scripts/verify-email.ts <email>
 */
import { prisma } from "../src/lib/db";

async function main() {
  const email = process.argv[2];
  if (!email) throw new Error("사용법: npx tsx scripts/verify-email.ts <email>");

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, emailVerifiedAt: true, nickname: true },
  });
  if (!user) {
    console.log(`❌ ${email} 계정이 없어요 (가입 먼저 필요).`);
    return;
  }
  if (user.emailVerifiedAt) {
    console.log(`ℹ️ 이미 인증된 계정: ${email} (닉네임: ${user.nickname ?? "미설정"})`);
    return;
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerifiedAt: new Date() },
  });
  console.log(`✅ 이메일 인증 처리 완료: ${email} → 이제 로그인 가능`);
}

main().finally(() => prisma.$disconnect());
