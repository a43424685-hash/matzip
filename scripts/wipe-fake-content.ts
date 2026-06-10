/** 시드(가짜) 콘텐츠 전부 삭제 — 사용자/레벨은 유지. 실행 후 운영자가 진짜 맛집을 올린다. */
import { prisma } from "../src/lib/db";
async function main() {
  await prisma.collectionVisit.deleteMany({});
  await prisma.mapPurchase.deleteMany({});
  await prisma.collectionItem.deleteMany({});
  await prisma.collection.deleteMany({});
  await prisma.commentLike.deleteMany({});
  await prisma.comment.deleteMany({});
  await prisma.postShare.deleteMany({});
  await prisma.like.deleteMany({});
  await prisma.save.deleteMany({});
  await prisma.proofAttempt.deleteMany({});
  await prisma.media.deleteMany({});
  await prisma.restaurantPostCategory.deleteMany({});
  await prisma.restaurantPost.deleteMany({});
  await prisma.restaurant.deleteMany({});
  await prisma.userRegionStat.deleteMany({});
  await prisma.rankingCache.deleteMany({});
  console.log("✅ 가짜 콘텐츠 삭제 완료");
  console.log(`   음식점 ${await prisma.restaurant.count()} / 글 ${await prisma.restaurantPost.count()} / 지도 ${await prisma.collection.count()} / 구매 ${await prisma.mapPurchase.count()}`);
}
main().finally(() => prisma.$disconnect());
