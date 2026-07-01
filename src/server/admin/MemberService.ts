/**
 * MemberService — 운영자(관리자) 회원 조회. 검색 + 회원 360도 뷰.
 * 개인정보(실명·계좌·이메일)는 호출부에서 마스킹해 노출한다.
 */
import { prisma } from "@/lib/db";
import { getSellerEarnings } from "@/server/payment/PaymentService";

export interface MemberRow {
  id: string;
  nickname: string;
  email: string;
  isAdmin: boolean;
  deactivated: boolean;
  totalLevel: number;
  createdAt: Date;
  postCount: number;
  followerCount: number;
  purchaseCount: number;
}

/** 닉네임/이메일 부분검색. 최신 가입순. */
export async function searchMembers(q?: string, skip = 0, take = 30): Promise<MemberRow[]> {
  const where = q?.trim()
    ? {
        OR: [
          { nickname: { contains: q.trim(), mode: "insensitive" as const } },
          { email: { contains: q.trim(), mode: "insensitive" as const } },
        ],
      }
    : {};
  const rows = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip,
    take,
    select: {
      id: true,
      nickname: true,
      email: true,
      isAdmin: true,
      deactivatedAt: true,
      totalLevel: true,
      createdAt: true,
      _count: { select: { posts: true, followers: true, mapPurchases: true } },
    },
  });
  return rows.map((u) => ({
    id: u.id,
    nickname: u.nickname,
    email: u.email,
    isAdmin: u.isAdmin,
    deactivated: !!u.deactivatedAt,
    totalLevel: u.totalLevel,
    createdAt: u.createdAt,
    postCount: u._count.posts,
    followerCount: u._count.followers,
    purchaseCount: u._count.mapPurchases,
  }));
}

export async function countMembers(): Promise<number> {
  return prisma.user.count();
}

/** 회원 상세(360도 뷰) — 프로필/실적/정산/신뢰 지표를 한 화면에 모음. */
export async function getMemberDetail(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      nickname: true,
      email: true,
      avatarUrl: true,
      isAdmin: true,
      deactivatedAt: true,
      createdAt: true,
      totalXp: true,
      totalLevel: true,
      legalName: true,
      bankName: true,
      accountNumber: true,
      accountHolder: true,
      _count: {
        select: {
          posts: true,
          followers: true,
          following: true,
          mapPurchases: true,
          collections: true,
          withdrawals: true,
          blockedBy: true, // 이 회원을 차단한 사람 수(신뢰 지표)
          reports: true, // 이 회원이 접수한 신고 수
        },
      },
    },
  });
  if (!user) return null;

  const [earnings, recentPosts] = await Promise.all([
    getSellerEarnings(userId),
    prisma.restaurantPost.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        shortReview: true,
        createdAt: true,
        locationVerified: true,
        isOperatorPick: true,
        restaurant: { select: { name: true } },
      },
    }),
  ]);

  return { user, earnings, recentPosts };
}
