/**
 * 콘텐츠 백지화 + 운영자 만렙 세팅 (1회용 운영 스크립트).
 *  - 모든 맛집/글/미디어/저장/컬렉션/댓글/알림/신고/차단/공유/증거/XP/지역통계/랭킹캐시 삭제
 *  - 데모 계정(demo_a, demo_b) 삭제
 *  - 운영자(zzllaa7788@daum.net) Lv.200 고정 (만렙 누적 XP 세팅 → 캡으로 안정 유지)
 *  - 나머지 일반 사용자는 XP/레벨 0/1 로 초기화
 * 실행: npx tsx scripts/reset-content.ts
 */
import { prisma } from "../src/lib/db";
import { cumulativeXpForLevel, MAX_LEVEL } from "../src/server/xp/LevelService";

const DEMO_EMAILS = ["demo_a@test.com", "demo_b@test.com", "demo_op@test.com"];
const OPERATOR_EMAIL = "zzllaa7788@daum.net";

async function main() {
  // 1) 콘텐츠 전부 삭제 (자식 → 부모 순, cascade 와 무관하게 명시적으로)
  await prisma.notification.deleteMany({});
  await prisma.report.deleteMany({});
  await prisma.block.deleteMany({});
  await prisma.xpEvent.deleteMany({});
  await prisma.commentLike.deleteMany({});
  await prisma.comment.deleteMany({});
  await prisma.postShare.deleteMany({});
  await prisma.like.deleteMany({});
  await prisma.save.deleteMany({});
  await prisma.proofAttempt.deleteMany({});
  await prisma.media.deleteMany({});
  await prisma.restaurantPostCategory.deleteMany({});
  await prisma.collectionItem.deleteMany({});
  await prisma.collection.deleteMany({});
  await prisma.ownerPromotion.deleteMany({});
  await prisma.restaurantPost.deleteMany({});
  await prisma.restaurant.deleteMany({});
  await prisma.userRegionStat.deleteMany({});
  await prisma.rankingCache.deleteMany({});

  // 2) 데모 계정 삭제
  const delUsers = await prisma.user.deleteMany({ where: { email: { in: DEMO_EMAILS } } });

  // 3) 나머지 일반 사용자 XP/레벨 초기화
  await prisma.user.updateMany({
    where: { email: { not: OPERATOR_EMAIL } },
    data: { totalXp: 0, totalLevel: 1 },
  });

  // 4) 운영자 Lv.200 (만렙 누적 XP → 캡 고정)
  const maxXp = cumulativeXpForLevel(MAX_LEVEL);
  const op = await prisma.user
    .update({
      where: { email: OPERATOR_EMAIL },
      data: { totalXp: maxXp, totalLevel: MAX_LEVEL },
      select: { email: true, totalLevel: true },
    })
    .catch(() => null);

  console.log(`✅ 콘텐츠 백지화 완료`);
  console.log(`   데모 계정 삭제: ${delUsers.count}명`);
  console.log(`   맛집 ${await prisma.restaurant.count()} / 글 ${await prisma.restaurantPost.count()} / 컬렉션 ${await prisma.collection.count()}`);
  console.log(op ? `   운영자: ${op.email} → Lv.${op.totalLevel} (만렙 XP ${maxXp})` : `   ⚠️ 운영자(${OPERATOR_EMAIL}) 없음`);
}

main().finally(() => prisma.$disconnect());
