/**
 * 스모크 테스트 — "등록(XP 0) → 위치 인증(보류 XP 해제) → 반응(인증글만) → 레벨 → 랭킹" 루프 검증.
 * 실행: npm run smoke
 * (멱등: 같은 이메일 데모 유저를 지우고 다시 만든다. 데모 데이터로도 활용 가능)
 */
import { prisma } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";
import {
  createRestaurantPost,
  toggleLike,
  toggleSave,
  recordShare,
} from "../src/server/restaurant/RestaurantService";
import {
  getOverallUserRanking,
  getRegionUserRanking,
  getWeeklyRestaurantRanking,
  getMyOverallRank,
  refreshRankingCache,
} from "../src/server/ranking/RankingService";
import {
  createCollection,
  toggleItem,
  getCollectionDetail,
  getMyCollectionsWithPreview,
} from "../src/server/collection/CollectionService";
import {
  attachPhoto,
  verifyLocation,
} from "../src/server/verification/VerificationService";
import { deletePost, searchPosts } from "../src/server/restaurant/RestaurantService";
import { createReport, listReports } from "../src/server/report/ReportService";
import { blockUser, unblockUser, getBlockedIds } from "../src/server/block/BlockService";
import { unreadCount, markAllRead, listNotifications } from "../src/server/notification/NotificationService";
import { regionFromAddress } from "../src/server/place/PlaceSearchService";
import {
  addComment,
  toggleCommentLike,
  togglePinComment,
  deleteComment,
  getComments,
} from "../src/server/comment/CommentService";
import { calculateLevel } from "../src/server/xp/LevelService";
import { XP_AMOUNT, ABUSE_LIMITS } from "../src/server/xp/xpRules";

function startOfTodayDate(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

const EMAILS = ["demo_a@test.com", "demo_b@test.com", "demo_op@test.com"];

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("ASSERT FAILED: " + msg);
  console.log("  ✓ " + msg);
}

async function totalXp(userId: string): Promise<number> {
  return (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).totalXp;
}

async function main() {
  // 0) 정리 + 데모 유저 생성 (음식점 → 유저 순으로 삭제해 FK 충돌 방지)
  const existing = await prisma.user.findMany({
    where: { email: { in: EMAILS } },
    select: { id: true },
  });
  const ids = existing.map((u) => u.id);
  if (ids.length) {
    await prisma.restaurant.deleteMany({ where: { createdByUserId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
  const pw = await hashPassword("test123");
  const a = await prisma.user.create({
    data: {
      email: EMAILS[0],
      nickname: "맛잘알A",
      passwordHash: pw,
      emailVerifiedAt: new Date(),
      nicknameConfirmedAt: new Date(),
    },
  });
  const b = await prisma.user.create({
    data: {
      email: EMAILS[1],
      nickname: "맛잘알B",
      passwordHash: pw,
      emailVerifiedAt: new Date(),
      nicknameConfirmedAt: new Date(),
    },
  });
  // 운영자(admin) — 노출 정책/랭킹 제외 검증용
  const op = await prisma.user.create({
    data: {
      email: EMAILS[2],
      nickname: "운영자OP",
      passwordHash: pw,
      emailVerifiedAt: new Date(),
      nicknameConfirmedAt: new Date(),
      isAdmin: true,
    },
  });
  const seoul = await prisma.region.findUniqueOrThrow({ where: { name: "서울" } });
  const busan = await prisma.region.findUniqueOrThrow({ where: { name: "부산" } });
  const cats = await prisma.category.findMany({ take: 4, select: { id: true } });

  console.log("\n[1] A가 서울 맛집 등록 — 미인증 등록은 XP 0 (전부 보류)");
  const r1 = await createRestaurantPost({
    userId: a.id,
    name: "을지로 노포 테스트집",
    primaryRegionId: seoul.id,
    shortReview: "여기 진짜 노포 감성 미쳤어요",
    content: "상세 리뷰입니다. 분위기 최고.",
    priceRange: "10k_20k",
    revisitIntent: "yes",
    categoryIds: cats.map((c) => c.id),
    media: [{ type: "image", url: "/sample-food.svg" }],
  });
  assert(r1.awardedXp === 0, `등록 XP = 0 (실제 ${r1.awardedXp})`);
  assert((await totalXp(a.id)) === 0, "A 전체 XP = 0 (등록만으론 적립 없음)");
  const seoulStat0 = await prisma.userRegionStat.findUniqueOrThrow({
    where: { userId_regionId: { userId: a.id, regionId: seoul.id } },
  });
  assert(seoulStat0.regionXp === 0, `A 서울 지역 XP = 0 (실제 ${seoulStat0.regionXp})`);

  console.log("\n[1b] 좌표 부여 후 A가 서울 글 위치 인증 → 보류 XP 일괄 해제");
  const seoulPost = await prisma.restaurantPost.findFirstOrThrow({
    where: { userId: a.id, restaurant: { primaryRegionId: seoul.id } },
    select: { id: true, restaurantId: true },
  });
  await prisma.restaurant.update({
    where: { id: seoulPost.restaurantId },
    data: { latitude: 37.5662, longitude: 126.9912 },
  });
  // 기대 해제 XP(기록/콘텐츠 + 등록 사진 — 영수증·메뉴판 증거 XP는 인증 후 현장 촬영 시 별도):
  //   위치150 + 첫인증50 + 기본50 + 등록사진50 + 한줄평40 + 상세70 + 카테고리30 + 가격10 + 재방문10 = 460
  const expectRelease =
    XP_AMOUNT.location_verified +
    XP_AMOUNT.daily_first_verify +
    XP_AMOUNT.post_created +
    XP_AMOUNT.photo_added + // 등록 사진(이미지 미디어) — 인증 시 함께 해제
    XP_AMOUNT.short_review +
    XP_AMOUNT.detail_review +
    XP_AMOUNT.categories +
    XP_AMOUNT.price +
    XP_AMOUNT.revisit;
  const v1 = await verifyLocation(a.id, seoulPost.id, {
    lat: 37.5662,
    lng: 126.9912,
    accuracy: 12,
  });
  assert(v1.verified && v1.reason === "OK", `위치 인증 성공 (${v1.distanceMeters}m)`);
  assert(v1.awardedXp === expectRelease, `해제 XP = ${expectRelease} (실제 ${v1.awardedXp})`);
  assert((await totalXp(a.id)) === expectRelease, `A 전체 XP = ${expectRelease}`);
  const seoulStat1 = await prisma.userRegionStat.findUniqueOrThrow({
    where: { userId_regionId: { userId: a.id, regionId: seoul.id } },
  });
  assert(seoulStat1.regionXp === expectRelease, `A 서울 지역 XP = ${expectRelease} (실제 ${seoulStat1.regionXp})`);
  assert(
    (await prisma.user.findUniqueOrThrow({ where: { id: a.id } })).totalLevel ===
      calculateLevel(expectRelease).level,
    "전체 레벨 = calculateLevel(해제 XP)"
  );

  console.log("\n[2] A가 부산 맛집 등록(미인증) → XP 0, 부산 지역 XP 0, 서울 영향 없음");
  await createRestaurantPost({
    userId: a.id,
    name: "해운대 회센터 테스트",
    primaryRegionId: busan.id,
    shortReview: "회 신선",
    categoryIds: [cats[0].id],
    media: [],
  });
  const seoulStat2 = await prisma.userRegionStat.findUniqueOrThrow({
    where: { userId_regionId: { userId: a.id, regionId: seoul.id } },
  });
  const busanStat = await prisma.userRegionStat.findUniqueOrThrow({
    where: { userId_regionId: { userId: a.id, regionId: busan.id } },
  });
  assert(seoulStat2.regionXp === expectRelease, "서울 지역 XP 그대로 (부산 등록 영향 없음)");
  assert(busanStat.regionXp === 0, `미인증 부산 등록은 지역 XP 0 (실제 ${busanStat.regionXp})`);
  const busanPost = await prisma.restaurantPost.findFirstOrThrow({
    where: { userId: a.id, restaurant: { primaryRegionId: busan.id } },
    select: { id: true, restaurantId: true },
  });

  console.log("\n[3] B가 A의 인증된 서울 글에 좋아요 → A +10, 멱등성 확인");
  let before = await totalXp(a.id);
  await toggleLike(b.id, seoulPost.id);
  let after = await totalXp(a.id);
  assert(after === before + 10, `인증글 좋아요로 A XP +10 (${before}→${after})`);
  await toggleLike(b.id, seoulPost.id); // unlike
  await toggleLike(b.id, seoulPost.id); // re-like
  assert((await totalXp(a.id)) === before + 10, "재좋아요는 XP 재지급 없음 (멱등)");

  console.log("\n[3b] B가 A의 미인증 부산 글에 좋아요 → XP 0 (반응 XP는 인증글만)");
  before = await totalXp(a.id);
  await toggleLike(b.id, busanPost.id);
  assert((await totalXp(a.id)) === before, "미인증 글 좋아요는 XP 0 (게이팅)");

  console.log("\n[4] B가 A의 인증된 서울 맛집 저장 → A +25");
  before = await totalXp(a.id);
  await toggleSave(b.id, seoulPost.restaurantId, seoulPost.id);
  assert((await totalXp(a.id)) === before + 25, `저장으로 A XP +25`);

  console.log("\n[4b] 저장 취소 시 restaurant.saveCount 와 post.saveCount 둘 다 감소");
  const rBefore = await prisma.restaurant.findUniqueOrThrow({
    where: { id: seoulPost.restaurantId },
    select: { saveCount: true },
  });
  const pBefore = await prisma.restaurantPost.findUniqueOrThrow({
    where: { id: seoulPost.id },
    select: { saveCount: true },
  });
  await toggleSave(b.id, seoulPost.restaurantId, seoulPost.id); // 저장 취소
  const rAfter = await prisma.restaurant.findUniqueOrThrow({
    where: { id: seoulPost.restaurantId },
    select: { saveCount: true },
  });
  const pAfter = await prisma.restaurantPost.findUniqueOrThrow({
    where: { id: seoulPost.id },
    select: { saveCount: true },
  });
  assert(rAfter.saveCount === rBefore.saveCount - 1, `restaurant.saveCount -1`);
  assert(pAfter.saveCount === pBefore.saveCount - 1, `post.saveCount -1 (화면 불일치 버그 회귀 방지)`);
  await toggleSave(b.id, seoulPost.restaurantId, seoulPost.id); // 복구 (멱등 → XP 재지급 없음)

  console.log("\n[5] XP 이벤트 로그 확인");
  const events = await prisma.xpEvent.count({ where: { userId: a.id } });
  assert(events > 0, `A의 XP 이벤트 로그 ${events}건 기록됨`);

  console.log("\n[6] 랭킹 3종 조회");
  const overall = await getOverallUserRanking();
  const region = await getRegionUserRanking(seoul.id);
  const weekly = await getWeeklyRestaurantRanking();
  assert(overall.some((r) => r.userId === a.id), "전체 랭킹에 A 등장");
  assert(!overall.some((r) => r.userId === op.id), "운영자(admin)는 전체 랭킹에서 제외");
  assert((await getMyOverallRank(op.id)) === 0, "운영자 내 순위는 0(— 표시)");
  assert(region.some((r) => r.userId === a.id), "서울 지역 랭킹에 A 등장");
  assert(weekly.length > 0, `이번 주 인기 맛집 ${weekly.length}곳`);
  console.log("    전체 1위:", overall[0]?.nickname, "Lv." + overall[0]?.level);

  console.log("\n[7] 랭킹 캐시 적재 (전체/지역/주간 3종 모두)");
  await refreshRankingCache();
  const [cOverall, cRegion, cWeekly] = await Promise.all([
    prisma.rankingCache.count({ where: { rankingType: "overall_users" } }),
    prisma.rankingCache.count({ where: { rankingType: "region_users" } }),
    prisma.rankingCache.count({ where: { rankingType: "weekly_restaurants" } }),
  ]);
  assert(cOverall > 0, `overall_users 캐시 ${cOverall}건`);
  assert(cRegion > 0, `region_users 캐시 ${cRegion}건 (지역 랭킹 캐시 누락 회귀 방지)`);
  assert(cWeekly > 0, `weekly_restaurants 캐시 ${cWeekly}건`);

  console.log("\n[8] 맛집 컬렉션 생성/담기/조회 (XP·랭킹과 무관한 큐레이션)");
  const col = await createCollection({
    userId: a.id,
    title: "맛잘알A의 서울·부산 맛집",
    description: "데모 컬렉션",
    regionId: seoul.id,
    isPublic: true,
  });
  const add1 = await toggleItem(a.id, col.id, seoulPost.restaurantId);
  const add2 = await toggleItem(a.id, col.id, busanPost.restaurantId);
  assert(add1.added && add2.added, "맛집 2곳 담김");
  const dup = await toggleItem(a.id, col.id, seoulPost.restaurantId);
  assert(dup.added === false, "같은 맛집 재담기는 토글(제거)됨");
  await toggleItem(a.id, col.id, seoulPost.restaurantId); // 다시 담아 2곳 복구

  const detail = await getCollectionDetail(col.id);
  assert(detail!.itemCount === 2, `컬렉션 맛집 수 = 2 (실제 ${detail!.itemCount})`);
  assert(detail!.regionName === "서울", "컬렉션 대표 지역(필수) 표시");
  const verifiedItem = detail!.items.find((i) => i.restaurantId === seoulPost.restaurantId)!;
  assert(
    verifiedItem.verification.location && !verifiedItem.verification.receipt && !verifiedItem.verification.menu,
    "위치 인증됨 + 아직 증거 미첨부 → 위치 뱃지만 표시"
  );

  let forbidden = false;
  try {
    await toggleItem(b.id, col.id, seoulPost.restaurantId);
  } catch {
    forbidden = true;
  }
  assert(forbidden, "소유자 아닌 사용자의 항목 변경 거부(FORBIDDEN)");
  const mine = await getMyCollectionsWithPreview(a.id);
  assert(mine.some((c) => c.id === col.id && c.itemCount === 2), "내 컬렉션 미리보기에 노출");

  console.log("\n[9] 방문 인증 정책 (위치 50m·정확도 50m·좌표필수 / 증거=인증 후 첨부+뱃지+XP / 소유자만)");

  // 미인증 글엔 증거 첨부 불가 (NOT_VERIFIED) — busan 은 아직 미인증
  let notVerified = false;
  try {
    await attachPhoto(a.id, busanPost.id, "receipt", "/sample-food.svg");
  } catch (e) {
    notVerified = (e as Error).message === "NOT_VERIFIED";
  }
  assert(notVerified, "미인증 글엔 증거 첨부 불가(NOT_VERIFIED)");

  // 인증된 서울 글에 증거(영수증·메뉴판) 첨부 → 각 XP + 뱃지 ON + 3종 풀인증 보너스
  let xp0 = await totalXp(a.id);
  await attachPhoto(a.id, seoulPost.id, "receipt", "/sample-food.svg");
  assert((await totalXp(a.id)) === xp0 + XP_AMOUNT.receipt_verified, `영수증 첨부 → +${XP_AMOUNT.receipt_verified}`);
  xp0 = await totalXp(a.id);
  await attachPhoto(a.id, seoulPost.id, "menu", "/sample-food.svg");
  assert(
    (await totalXp(a.id)) === xp0 + XP_AMOUNT.menu_verified + XP_AMOUNT.full_verify_bonus,
    `메뉴판 첨부 → +${XP_AMOUNT.menu_verified} + 3종 풀인증 보너스 +${XP_AMOUNT.full_verify_bonus}`
  );
  const badges = await prisma.restaurantPost.findUniqueOrThrow({
    where: { id: seoulPost.id },
    select: { receiptVerified: true, menuVerified: true },
  });
  assert(
    badges.receiptVerified && badges.menuVerified,
    "증거 첨부 시 인증 뱃지 ON (영수증·메뉴판)"
  );

  // 좌표 없는 부산 가게 → NO_COORDS
  const noCoords = await verifyLocation(a.id, busanPost.id, { lat: 35.158, lng: 129.16, accuracy: 10 });
  assert(!noCoords.verified && noCoords.reason === "NO_COORDS", "좌표 없는 가게는 위치 인증 불가(NO_COORDS)");

  // 좌표 부여 후: 정확도 미달(>50m) → LOW_ACCURACY
  await prisma.restaurant.update({
    where: { id: busanPost.restaurantId },
    data: { latitude: 35.1587, longitude: 129.1604 },
  });
  const lowAcc = await verifyLocation(a.id, busanPost.id, { lat: 35.1587, lng: 129.1604, accuracy: 80 });
  assert(!lowAcc.verified && lowAcc.reason === "LOW_ACCURACY", "GPS 정확도 50m 초과 → 재시도(LOW_ACCURACY)");

  // 50m 초과 → TOO_FAR
  const tooFar = await verifyLocation(a.id, busanPost.id, { lat: 35.17, lng: 129.17, accuracy: 10 });
  assert(!tooFar.verified && tooFar.reason === "TOO_FAR", `50m 초과 → 인증 거부(TOO_FAR, ${tooFar.distanceMeters}m)`);

  // 50m 이내 + 정확도 양호 → 성공
  const ok = await verifyLocation(a.id, busanPost.id, { lat: 35.1587, lng: 129.1604, accuracy: 12 });
  assert(ok.verified && ok.reason === "OK", `가게 50m 이내 인증 성공 (${ok.distanceMeters}m)`);

  // 본인 아닌 기록 인증/첨부 거부
  let vForbidden = false;
  try {
    await attachPhoto(b.id, seoulPost.id, "menu", "/x.svg");
  } catch {
    vForbidden = true;
  }
  assert(vForbidden, "본인 아닌 기록 인증/첨부 거부(FORBIDDEN)");

  console.log("\n[9b] 공유 XP (인증글만 / 1회 / 자기글 0 / 미인증 0 / 하루상한은 XP만 막고 기록은 남김)");
  // 자기 글 공유 → 기록/XP 없음
  let bx = await totalXp(a.id);
  let s = await recordShare(a.id, seoulPost.id);
  assert(!s.awarded && !s.recorded && s.reason === "SELF" && (await totalXp(a.id)) === bx, "자기 글 공유 = 기록/XP 없음(SELF)");

  // B가 A의 인증된 서울 글 공유 → A +40, shareCount 1
  bx = await totalXp(a.id);
  s = await recordShare(b.id, seoulPost.id);
  assert(s.awarded && s.reason === "OK" && (await totalXp(a.id)) === bx + XP_AMOUNT.shared, `인증글 공유 → 작성자 +${XP_AMOUNT.shared}`);
  assert(s.recorded && s.shareCount === 1, `shareCount = 1 (실제 ${s.shareCount})`);

  // B가 같은 글 또 공유 → DUPLICATE, XP 0, shareCount 그대로
  bx = await totalXp(a.id);
  s = await recordShare(b.id, seoulPost.id);
  assert(!s.awarded && s.reason === "DUPLICATE" && (await totalXp(a.id)) === bx, "같은 유저·같은 글 재공유 XP 0(DUPLICATE)");
  assert(s.shareCount === 1, "중복 공유는 shareCount 안 올림 (그대로 1)");

  // 미인증 글 공유 → 기록/XP 없음 (부산 글을 잠깐 미인증으로)
  await prisma.restaurantPost.update({ where: { id: busanPost.id }, data: { locationVerified: false } });
  bx = await totalXp(a.id);
  s = await recordShare(b.id, busanPost.id);
  assert(!s.awarded && !s.recorded && s.reason === "UNVERIFIED" && (await totalXp(a.id)) === bx, "미인증 글 공유 = 기록/XP 없음(UNVERIFIED)");
  await prisma.restaurantPost.update({ where: { id: busanPost.id }, data: { locationVerified: true } });

  // 하루 공유 XP 상한: B의 오늘 shared 이벤트를 상한까지 채운 뒤 부산 글 공유 → 기록·shareCount 는 남고 XP만 0
  const have = await prisma.xpEvent.count({
    where: { actorUserId: b.id, sourceType: "shared", createdAt: { gte: startOfTodayDate() } },
  });
  for (let i = have; i < ABUSE_LIMITS.dailyShareXpCap; i++) {
    await prisma.xpEvent.create({
      data: { userId: a.id, actorUserId: b.id, regionId: seoul.id, sourceType: "shared", sourceId: `dummy-${i}`, xpAmount: 0, dedupeKey: `dummy-share-${i}` },
    });
  }
  bx = await totalXp(a.id);
  const sc0 = (await prisma.restaurantPost.findUniqueOrThrow({ where: { id: busanPost.id }, select: { shareCount: true } })).shareCount;
  s = await recordShare(b.id, busanPost.id);
  assert(s.recorded && !s.awarded && s.reason === "DAILY_CAP", "하루 상한 초과: 기록은 남고 XP만 0(DAILY_CAP)");
  assert((await totalXp(a.id)) === bx, "상한 초과 시 작성자 XP 변화 없음");
  assert(s.shareCount === sc0 + 1, "상한 초과여도 shareCount 는 증가 (기록≠XP상한)");
  const shareRec = await prisma.postShare.findUnique({ where: { userId_postId: { userId: b.id, postId: busanPost.id } } });
  assert(!!shareRec, "상한 초과여도 PostShare 기록은 남음 (dedupe 보장)");

  console.log("\n[9c] 같은 가게 판별 — 카카오 장소 ID 우선 (Restaurant 중복 방지)");
  const pA = await createRestaurantPost({ userId: a.id, name: "스타벅스 강남", primaryRegionId: seoul.id, kakaoPlaceId: "KPLACE_1", categoryIds: [cats[0].id], media: [] });
  const restCountBefore = await prisma.restaurant.count();
  const postCountBefore = await prisma.restaurantPost.count();
  const pB = await createRestaurantPost({ userId: b.id, name: "스타벅스강남점", primaryRegionId: seoul.id, kakaoPlaceId: "KPLACE_1", categoryIds: [cats[0].id], media: [] });
  assert(pA.restaurantId === pB.restaurantId, "같은 장소 ID = 같은 가게 (이름 달라도 합쳐짐)");
  assert((await prisma.restaurant.count()) === restCountBefore, "같은 kakaoPlaceId 재등록 → Restaurant 새로 안 생김(중복 방지)");
  assert((await prisma.restaurantPost.count()) === postCountBefore + 1, "단, 새 방문 기록(RestaurantPost)은 생성됨");
  assert((await prisma.restaurant.count({ where: { kakaoPlaceId: "KPLACE_1" } })) === 1, "kakaoPlaceId=KPLACE_1 Restaurant 정확히 1개");
  const pC = await createRestaurantPost({ userId: a.id, name: "스타벅스 강남", primaryRegionId: seoul.id, kakaoPlaceId: "KPLACE_2", categoryIds: [cats[0].id], media: [] });
  assert(pC.restaurantId !== pA.restaurantId, "다른 장소 ID = 다른 가게 (이름 같아도 안 합쳐짐)");
  const pM1 = await createRestaurantPost({ userId: a.id, name: "직접입력 노포", primaryRegionId: seoul.id, categoryIds: [cats[0].id], media: [] });
  const pM2 = await createRestaurantPost({ userId: b.id, name: "직접입력 노포", primaryRegionId: seoul.id, categoryIds: [cats[0].id], media: [] });
  assert(pM1.restaurantId === pM2.restaurantId, "장소 ID 없으면 이름+지역으로 같은 가게 판별");

  console.log("\n[9d] 댓글 — 작성/답글/좋아요/고정/도배방지/삭제 (경험치 없음)");
  const aXp0 = await totalXp(a.id);
  const bXp0 = await totalXp(b.id);
  const cnt = async () =>
    (await prisma.restaurantPost.findUniqueOrThrow({ where: { id: seoulPost.id }, select: { commentCount: true } })).commentCount;
  const c1 = await addComment(b.id, seoulPost.id, "여기 진짜 맛있어요");
  assert((await cnt()) === 1, "댓글 작성 → commentCount 1");
  // 도배 방지: b의 직전 댓글(c1)과 동일 내용 연속 금지
  let dupErr = false;
  try { await addComment(b.id, seoulPost.id, "여기 진짜 맛있어요"); } catch (e) { dupErr = (e as Error).message === "DUPLICATE"; }
  assert(dupErr, "같은 내용 연속 금지(DUPLICATE)");
  const rep = await addComment(a.id, seoulPost.id, "감사합니다!", c1.id); // 답글
  assert((await cnt()) === 2, "답글 → commentCount 2");
  const rep2 = await addComment(b.id, seoulPost.id, "저도요!", rep.id); // 답글의 답글 (무한 중첩)
  assert((await cnt()) === 3, "답글에 답글도 가능 (무한 대댓글) → commentCount 3");
  const lk = await toggleCommentLike(a.id, c1.id);
  assert(lk.liked && lk.likeCount === 1, "댓글 좋아요 +1");
  const unlk = await toggleCommentLike(a.id, c1.id);
  assert(!unlk.liked && unlk.likeCount === 0, "댓글 좋아요 취소");
  const pin = await togglePinComment(a.id, c1.id);
  assert(pin.pinned, "글쓴이(a)가 댓글 고정");
  let pinForbidden = false;
  try { await togglePinComment(b.id, c1.id); } catch (e) { pinForbidden = (e as Error).message === "FORBIDDEN"; }
  assert(pinForbidden, "글쓴이 아니면 고정 불가(FORBIDDEN)");
  const list = await getComments(seoulPost.id, a.id);
  const top = list[0];
  assert(list.length === 1 && top.id === c1.id && top.isPinned, "최상위: 고정된 c1");
  assert(top.replies.length === 1 && top.replies[0].id === rep.id, "c1의 답글 = rep");
  assert(top.replies[0].replies.length === 1 && top.replies[0].replies[0].id === rep2.id, "rep의 답글 = rep2 (무한 중첩 트리)");
  assert((await totalXp(a.id)) === aXp0 && (await totalXp(b.id)) === bXp0, "댓글은 경험치 없음");
  const del = await deleteComment(b.id, c1.id);
  assert(del.deleted === 3, "본인 댓글 삭제 → 딸린 답글 전부 삭제(3, 무한 깊이 cascade)");
  assert((await cnt()) === 0, "삭제 후 commentCount 0");

  console.log("\n[9e] 운영 안전장치 — 신고 + 글/댓글 삭제 (작성자/운영자)");
  const repPost = await createRestaurantPost({
    userId: a.id, name: "신고테스트집", primaryRegionId: seoul.id, categoryIds: [cats[0].id], media: [],
  });
  let rr = await createReport({ reporterId: a.id, targetType: "post", targetId: repPost.postId, reason: "spam" });
  assert(!rr.ok && rr.reason === "SELF", "자기 글 신고 불가(SELF)");
  rr = await createReport({ reporterId: b.id, targetType: "post", targetId: repPost.postId, reason: "spam" });
  assert(rr.ok, "다른 사용자가 글 신고 성공");
  rr = await createReport({ reporterId: b.id, targetType: "post", targetId: repPost.postId, reason: "abuse" });
  assert(!rr.ok && rr.reason === "DUPLICATE", "같은 사용자·같은 글 중복 신고 불가(DUPLICATE)");
  let openReports = await listReports("open");
  assert(openReports.some((x) => x.targetId === repPost.postId), "신고함(open)에 노출됨");
  let dp = await deletePost(b.id, repPost.postId, false);
  assert(!dp.ok && dp.reason === "FORBIDDEN", "남의 글을 비운영자가 삭제 거부(FORBIDDEN)");
  dp = await deletePost(b.id, repPost.postId, true);
  assert(dp.ok, "운영자가 글 삭제 성공");
  openReports = await listReports("open");
  assert(!openReports.some((x) => x.targetId === repPost.postId), "글 삭제 시 해당 신고 자동 처리(open에서 사라짐)");
  assert(
    !(await prisma.restaurantPost.findUnique({ where: { id: repPost.postId } })),
    "삭제된 글은 DB에서 사라짐"
  );

  console.log("\n[9f] 차단 — 글/댓글 숨김 + 해제");
  await addComment(a.id, seoulPost.id, "차단 테스트용 댓글 by A");
  const hasA = (nodes: { user: { id: string }; replies: unknown[] }[]): boolean =>
    nodes.some((n) => n.user.id === a.id || hasA(n.replies as typeof nodes));

  // 차단 전: b 에게 a 글/댓글 보임
  let bIds = (await searchPosts({ excludeUserIds: await getBlockedIds(b.id) })).map((p) => p.id);
  assert(bIds.includes(seoulPost.id), "차단 전: b 검색에 a 글 보임");
  assert(hasA(await getComments(seoulPost.id, b.id)), "차단 전: b 에게 a 댓글 보임");

  const bl = await blockUser(b.id, a.id);
  assert(bl.ok, "b 가 a 차단 성공");
  assert(!(await blockUser(b.id, b.id)).ok, "자기 자신 차단 불가(SELF)");

  // 차단 후: b 에게 a 글/댓글 숨김
  bIds = (await searchPosts({ excludeUserIds: await getBlockedIds(b.id) })).map((p) => p.id);
  assert(!bIds.includes(seoulPost.id), "차단 후: b 검색에서 a 글 사라짐");
  assert(!hasA(await getComments(seoulPost.id, b.id)), "차단 후: b 에게 a 댓글 안 보임");

  // a 본인은 영향 없음 (자기 글 보임)
  const aIds = (await searchPosts({ excludeUserIds: await getBlockedIds(a.id) })).map((p) => p.id);
  assert(aIds.includes(seoulPost.id), "a 본인은 자기 글 그대로 보임 (단방향 차단)");

  await unblockUser(b.id, a.id);
  bIds = (await searchPosts({ excludeUserIds: await getBlockedIds(b.id) })).map((p) => p.id);
  assert(bIds.includes(seoulPost.id), "차단 해제 후: b 에게 a 글 다시 보임");

  console.log("\n[9g] 알림 + 키워드 검색");
  const np = await createRestaurantPost({
    userId: a.id, name: "알림테스트집", primaryRegionId: seoul.id, categoryIds: [cats[0].id], media: [],
  });
  await toggleLike(b.id, np.postId);
  assert(
    !!(await prisma.notification.findFirst({ where: { userId: a.id, type: "like", postId: np.postId } })),
    "좋아요 받으면 알림 생성"
  );
  // 재좋아요(취소→다시) 해도 좋아요 알림은 1개만 (멱등)
  await toggleLike(b.id, np.postId); // 취소
  await toggleLike(b.id, np.postId); // 다시
  assert(
    (await prisma.notification.count({
      where: { userId: a.id, actorUserId: b.id, type: "like", postId: np.postId },
    })) === 1,
    "재좋아요해도 좋아요 알림 1개(멱등)"
  );
  await toggleLike(a.id, np.postId); // 자기 글 좋아요
  assert(
    (await prisma.notification.count({ where: { userId: a.id, type: "like", actorUserId: a.id } })) === 0,
    "자기 글 좋아요는 알림 없음(셀프 제외)"
  );
  await addComment(b.id, np.postId, "알림용 댓글입니다");
  assert(
    !!(await prisma.notification.findFirst({ where: { userId: a.id, type: "comment", postId: np.postId } })),
    "댓글 받으면 알림 생성"
  );
  assert((await unreadCount(a.id)) > 0, "안 읽은 알림 카운트 > 0");
  // 차단하면 그 사용자의 알림은 숨김 (배치4 차단 전면적용)
  await blockUser(a.id, b.id);
  assert(
    !(await listNotifications(a.id)).some((n) => n.actorNickname === "맛잘알B"),
    "차단한 사용자의 알림은 숨김"
  );
  assert((await unreadCount(a.id)) === 0, "차단 후 안 읽은 카운트에서도 제외");
  await unblockUser(a.id, b.id);
  assert(
    (await listNotifications(a.id)).some((n) => n.actorNickname === "맛잘알B"),
    "차단 해제 후 알림 다시 보임"
  );
  await markAllRead(a.id);
  assert((await unreadCount(a.id)) === 0, "전체 읽음 처리 후 0");

  const kq = await searchPosts({ q: "을지로" });
  assert(kq.some((p) => p.id === seoulPost.id), "키워드 검색으로 가게 이름 매칭(인증 글)");
  const kq2 = await searchPosts({ q: "존재하지않는가게명xyz" });
  assert(kq2.length === 0, "없는 키워드는 결과 없음");

  console.log("\n[9h] 노출 정책 — 일반 미인증 숨김 / 운영자 글 노출");
  const userUnverified = await createRestaurantPost({
    userId: b.id, name: "일반미인증노출집", primaryRegionId: seoul.id, categoryIds: [cats[0].id], media: [],
  });
  const adminUnverified = await createRestaurantPost({
    userId: op.id, name: "운영자미인증노출집", primaryRegionId: seoul.id, categoryIds: [cats[0].id], media: [],
  });
  const exposeIds = (await searchPosts({ q: "노출집" })).map((p) => p.id);
  assert(!exposeIds.includes(userUnverified.postId), "일반 사용자 미인증 글은 검색/피드에서 숨김");
  assert(exposeIds.includes(adminUnverified.postId), "운영자 글은 미인증이어도 노출됨");

  console.log("\n[10] 장소 검색 — 주소 → 17개 시도 매핑");
  assert(regionFromAddress("서울특별시 중구 명동") === "서울", "서울특별시→서울");
  assert(regionFromAddress("부산광역시 해운대구 우동") === "부산", "부산광역시→부산");
  assert(regionFromAddress("경기도 성남시 분당구") === "경기", "경기도→경기");
  assert(regionFromAddress("경상남도 창원시") === "경남", "경상남도→경남");
  assert(regionFromAddress("제주특별자치도 제주시") === "제주", "제주→제주");
  assert(regionFromAddress("강원특별자치도 춘천시") === "강원", "강원특별자치도→강원");
  assert(regionFromAddress("California, USA") === null, "해외 주소는 매핑 안 됨(null)");

  console.log("\n✅ 모든 스모크 테스트 통과");
}

main()
  .catch((e) => {
    console.error("\n❌", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
