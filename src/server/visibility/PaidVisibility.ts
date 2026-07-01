/**
 * 유료 잠금 콘텐츠 접근 정책 — 중앙화.
 *
 * "잠긴 글" = 유료 지도(collection.isPaid=true)에 isPreview=false 로 들어간 post.
 * 접근 허용 예외: 글 소유자 / 구매자 / 관리자.
 * 운영자 글·맛보기(isPreview=true)·일반 공개 글은 잠금 아님.
 *
 * 핵심: 잠금은 "post 단위". 같은 음식점에 공개 post 가 따로 있으면 그건 노출된다.
 *
 * - visiblePostWhere(viewerId): 목록/검색/주변/프로필/홈 Prisma where 조각
 * - canViewPost(viewerId, postId): 상세/공유/OG 게이트
 * - visibleRestaurantHasPost(viewerId): 자동완성 — "볼 수 있는 글이 있는 음식점"
 */
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

/** 뷰어가 볼 수 없는(잠긴) post id 목록. 관리자/잠금없음이면 빈 배열. */
export async function hiddenPostIds(viewerId: string | null): Promise<string[]> {
  const locked = await prisma.collectionItem.findMany({
    where: { isPreview: false, postId: { not: null }, collection: { isPaid: true } },
    select: { postId: true, collectionId: true },
  });
  if (locked.length === 0) return [];

  if (viewerId) {
    const me = await prisma.user.findUnique({ where: { id: viewerId }, select: { isAdmin: true } });
    if (me?.isAdmin) return []; // 관리자는 전체 접근
  }

  const lockedPostIds = new Set(locked.map((l) => l.postId).filter((x): x is string => !!x));
  const accessible = new Set<string>();

  if (viewerId) {
    // 내가 쓴 잠긴 글 → 접근 가능
    const owned = await prisma.restaurantPost.findMany({
      where: { userId: viewerId, id: { in: [...lockedPostIds] } },
      select: { id: true },
    });
    owned.forEach((o) => accessible.add(o.id));
    // 내가 구매한 유료 지도에 든 글 → 접근 가능
    const purchases = await prisma.mapPurchase.findMany({
      where: { buyerId: viewerId, status: "paid" },
      select: { collectionId: true },
    });
    const bought = new Set(purchases.map((p) => p.collectionId));
    for (const l of locked) {
      if (l.postId && bought.has(l.collectionId)) accessible.add(l.postId);
    }
  }

  return [...lockedPostIds].filter((id) => !accessible.has(id));
}

/** 목록/검색용 where 조각 — 잠긴 글 제외(내가 볼 수 있는 건 유지). */
export async function visiblePostWhere(viewerId: string | null): Promise<Prisma.RestaurantPostWhereInput> {
  const hidden = await hiddenPostIds(viewerId);
  return hidden.length ? { id: { notIn: hidden } } : {};
}

/** 상세/공유/OG 게이트 — 이 뷰어가 이 글을 볼 수 있나. */
export async function canViewPost(viewerId: string | null, postId: string): Promise<boolean> {
  const lockedRows = await prisma.collectionItem.findMany({
    where: { postId, isPreview: false, collection: { isPaid: true } },
    select: { collectionId: true },
  });
  if (lockedRows.length === 0) return true; // 잠긴 글 아님 → 공개

  if (!viewerId) return false;
  const [post, me] = await Promise.all([
    prisma.restaurantPost.findUnique({ where: { id: postId }, select: { userId: true } }),
    prisma.user.findUnique({ where: { id: viewerId }, select: { isAdmin: true } }),
  ]);
  if (me?.isAdmin) return true;
  if (post?.userId === viewerId) return true;
  const bought = await prisma.mapPurchase.findFirst({
    where: { buyerId: viewerId, status: "paid", collectionId: { in: lockedRows.map((r) => r.collectionId) } },
    select: { id: true },
  });
  return !!bought;
}

/**
 * 자동완성용 — 음식점에 "뷰어가 볼 수 있는 공개 글"이 하나라도 있는지의 posts.some 조건.
 * 잠긴 글만 있는 음식점은 이름이 안 새고, 공개 글이 하나라도 있으면 노출.
 */
export async function visibleRestaurantPostFilter(
  viewerId: string | null
): Promise<Prisma.RestaurantPostListRelationFilter> {
  const hidden = await hiddenPostIds(viewerId);
  const some: Prisma.RestaurantPostWhereInput = { visibility: "public" };
  if (hidden.length) some.id = { notIn: hidden };
  return { some };
}
