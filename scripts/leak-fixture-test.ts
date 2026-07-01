/**
 * 실제 잠긴 유료글 fixture 를 만들어 접근정책 함수(canViewPost/hiddenPostIds/자동완성필터)를
 * 진짜로 테스트하고, 끝나면 전부 삭제한다. (실 DB 오염 없음)
 *   npx tsx scripts/leak-fixture-test.ts
 */
import { prisma } from "../src/lib/db";
import {
  canViewPost,
  hiddenPostIds,
  visiblePostWhere,
  visibleRestaurantPostFilter,
} from "../src/server/visibility/PaidVisibility";

const TAG = "LEAKTEST_" + Math.floor(Math.random() * 1e6);
let pass = 0,
  fail = 0;
function assert(cond: boolean, label: string) {
  if (cond) {
    pass++;
    console.log("  ✓", label);
  } else {
    fail++;
    console.log("  ✗", label);
  }
}

const ids: { users: string[]; restaurant?: string; collection?: string; posts: string[] } = { users: [], posts: [] };

async function main() {
  const admin = await prisma.user.findFirst({ where: { isAdmin: true }, select: { id: true } });
  const region = await prisma.region.findFirst({ select: { id: true } });
  if (!admin || !region) throw new Error("운영자 또는 지역이 없어 테스트 불가");

  const mkUser = async (role: string) => {
    const u = await prisma.user.create({
      data: { email: `${TAG}_${role}@test.local`, nickname: `${TAG}_${role}`, passwordHash: "x" },
      select: { id: true },
    });
    ids.users.push(u.id);
    return u.id;
  };
  const creator = await mkUser("creator"); // 비관리자 소유자
  const buyer = await mkUser("buyer");
  const other = await mkUser("other");

  const restaurant = await prisma.restaurant.create({
    data: {
      name: `${TAG}_가게`,
      primaryRegion: { connect: { id: region.id } },
      createdBy: { connect: { id: creator } },
    },
    select: { id: true },
  });
  ids.restaurant = restaurant.id;

  const collection = await prisma.collection.create({
    data: {
      user: { connect: { id: creator } },
      region: { connect: { id: region.id } },
      title: `${TAG}_유료지도`,
      isPaid: true,
      isPublic: true,
      priceWon: 3900,
    },
    select: { id: true },
  });
  ids.collection = collection.id;

  // 잠긴 글 (creator 소유, 유료지도에 isPreview=false 로 들어감)
  const lockedPost = await prisma.restaurantPost.create({
    data: {
      restaurant: { connect: { id: restaurant.id } },
      user: { connect: { id: creator } },
      visibility: "public",
      locationVerified: true,
    },
    select: { id: true },
  });
  ids.posts.push(lockedPost.id);
  await prisma.collectionItem.create({
    data: {
      collection: { connect: { id: collection.id } },
      restaurant: { connect: { id: restaurant.id } },
      post: { connect: { id: lockedPost.id } },
      isPreview: false,
    },
  });

  console.log(`\n① 잠긴 글 접근 정책 (post ${lockedPost.id})`);
  assert((await hiddenPostIds(null)).includes(lockedPost.id), "비로그인: hiddenPostIds 에 포함(숨김)");
  assert((await canViewPost(null, lockedPost.id)) === false, "비로그인: canViewPost = false (차단)");
  assert((await canViewPost(creator, lockedPost.id)) === true, "소유자: canViewPost = true");
  assert((await canViewPost(other, lockedPost.id)) === false, "비구매 타인: canViewPost = false");
  assert((await canViewPost(admin.id, lockedPost.id)) === true, "관리자: canViewPost = true");
  assert(!(await hiddenPostIds(admin.id)).includes(lockedPost.id), "관리자: hiddenPostIds 에서 제외");

  // 구매자 → 접근 가능
  await prisma.mapPurchase.create({
    data: {
      buyer: { connect: { id: buyer } },
      collection: { connect: { id: collection.id } },
      amountWon: 3900,
      feeWon: 1170,
      sellerNetWon: 2730,
      status: "paid",
    },
  });
  assert((await canViewPost(buyer, lockedPost.id)) === true, "구매자: canViewPost = true");

  console.log("\n② 목록 where (visiblePostWhere, 서브쿼리 최적화 경로)");
  const listAnon = await prisma.restaurantPost.findFirst({
    where: { AND: [await visiblePostWhere(null)], id: lockedPost.id },
    select: { id: true },
  });
  assert(listAnon === null, "비로그인 목록: 잠긴 글 제외됨");
  const listBuyer = await prisma.restaurantPost.findFirst({
    where: { AND: [await visiblePostWhere(buyer)], id: lockedPost.id },
    select: { id: true },
  });
  assert(listBuyer !== null, "구매자 목록: 잠긴 글 보임");

  console.log("\n③ 자동완성 누수 (잠긴 글만 있는 가게 이름)");
  const filterAnon = await visibleRestaurantPostFilter(null);
  const hitBefore = await prisma.restaurant.findFirst({ where: { name: `${TAG}_가게`, posts: filterAnon }, select: { id: true } });
  assert(hitBefore === null, "비로그인 자동완성: 잠긴 글만 있는 가게는 안 뜸");

  // 같은 가게에 '공개 글' 추가 → 이제 자동완성에 떠야 함 (post 단위 잠금, 가게 단위 아님)
  const publicPost = await prisma.restaurantPost.create({
    data: {
      restaurant: { connect: { id: restaurant.id } },
      user: { connect: { id: other } },
      visibility: "public",
      locationVerified: true,
    },
    select: { id: true },
  });
  ids.posts.push(publicPost.id);
  const hitAfter = await prisma.restaurant.findFirst({ where: { name: `${TAG}_가게`, posts: filterAnon }, select: { id: true } });
  assert(hitAfter !== null, "공개 글 추가 후: 같은 가게가 자동완성에 노출됨(과차단 아님)");
}

async function cleanup() {
  try {
    if (ids.collection) await prisma.mapPurchase.deleteMany({ where: { collectionId: ids.collection } });
    if (ids.collection) await prisma.collectionItem.deleteMany({ where: { collectionId: ids.collection } });
    if (ids.posts.length) await prisma.restaurantPost.deleteMany({ where: { id: { in: ids.posts } } });
    if (ids.collection) await prisma.collection.deleteMany({ where: { id: ids.collection } });
    if (ids.restaurant) await prisma.restaurant.deleteMany({ where: { id: ids.restaurant } });
    if (ids.users.length) await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
    console.log("\n🧹 fixture 삭제 완료");
  } catch (e) {
    console.log("⚠️ cleanup 오류:", e instanceof Error ? e.message : e);
  }
}

main()
  .catch((e) => {
    fail++;
    console.log("실행 오류:", e instanceof Error ? e.message : e);
  })
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
    console.log(fail === 0 ? `\n✅ 전부 통과 (${pass})` : `\n❌ ${fail}건 실패 / ${pass}건 통과`);
    process.exit(fail === 0 ? 0 : 1);
  });
