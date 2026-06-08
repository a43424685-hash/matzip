/**
 * 운영자(관리자) 지정/해제.
 * 사용법:
 *   npx tsx scripts/make-admin.ts <email>           # 운영자로 지정
 *   npx tsx scripts/make-admin.ts <email> off        # 운영자 해제
 */
import { prisma } from "../src/lib/db";

async function main() {
  const email = (process.argv[2] ?? "").trim().toLowerCase();
  const off = process.argv[3] === "off";
  if (!email) {
    console.error("사용법: npx tsx scripts/make-admin.ts <email> [off]");
    process.exit(1);
  }
  const u = await prisma.user
    .update({ where: { email }, data: { isAdmin: !off }, select: { email: true, isAdmin: true } })
    .catch(() => null);
  if (!u) console.error("❌ 해당 이메일 사용자가 없어요:", email);
  else console.log(`✅ ${u.email} → isAdmin=${u.isAdmin}`);
}

main().finally(() => prisma.$disconnect());
