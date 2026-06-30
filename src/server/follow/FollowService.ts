/**
 * 사용자 팔로우 — follower 가 following 을 팔로우 (단방향).
 * 팔로잉 피드는 내가 팔로우한 사람들의 공개 글만 모아서 보여준다.
 */
import { prisma } from "@/lib/db";

/** 팔로우 (자기 자신은 무시, 멱등) */
export async function followUser(followerId: string, followingId: string): Promise<void> {
  if (followerId === followingId) return; // 자기 자신은 팔로우 불가
  await prisma.follow.upsert({
    where: { followerId_followingId: { followerId, followingId } },
    create: { followerId, followingId },
    update: {},
  });
}

/** 언팔로우 */
export async function unfollowUser(followerId: string, followingId: string): Promise<void> {
  await prisma.follow.deleteMany({ where: { followerId, followingId } });
}

/** viewer 가 target 을 팔로우 중인지 */
export async function isFollowing(viewerId: string, targetId: string): Promise<boolean> {
  if (viewerId === targetId) return false;
  const row = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: viewerId, followingId: targetId } },
    select: { id: true },
  });
  return !!row;
}

/** 팔로워 / 팔로잉 수 */
export async function getFollowCounts(userId: string): Promise<{ followers: number; following: number }> {
  const [followers, following] = await Promise.all([
    prisma.follow.count({ where: { followingId: userId } }), // 나를 팔로우하는 사람
    prisma.follow.count({ where: { followerId: userId } }), // 내가 팔로우하는 사람
  ]);
  return { followers, following };
}
