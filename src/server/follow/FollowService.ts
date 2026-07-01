/**
 * 사용자 팔로우 — follower 가 following 을 팔로우 (단방향).
 * 팔로잉 피드는 내가 팔로우한 사람들의 공개 글만 모아서 보여준다.
 */
import { prisma } from "@/lib/db";
import { createNotification } from "@/server/notification/NotificationService";

/** 팔로우 (자기 자신은 무시, 멱등). 새 팔로우일 때만 알림 발송. */
export async function followUser(followerId: string, followingId: string): Promise<void> {
  if (followerId === followingId) return; // 자기 자신은 팔로우 불가
  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId, followingId } },
    select: { id: true },
  });
  if (existing) return; // 이미 팔로우 중 — 알림 중복 방지
  await prisma.follow.create({ data: { followerId, followingId } });
  // "OO님이 회원님을 팔로우했어요" 알림 (푸시 + 인앱)
  await createNotification(prisma, { userId: followingId, actorUserId: followerId, type: "follow" });
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

export interface FollowUserRow {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  totalLevel: number;
  isAdmin: boolean;
  viewerFollows: boolean; // 보는 사람(viewer)이 이 사람을 팔로우 중인지 — 맞팔 버튼용
}

async function decorateViewerFollows(
  users: { id: string; nickname: string; avatarUrl: string | null; totalLevel: number; isAdmin: boolean }[],
  viewerId: string | null
): Promise<FollowUserRow[]> {
  let followed = new Set<string>();
  if (viewerId && users.length) {
    const rows = await prisma.follow.findMany({
      where: { followerId: viewerId, followingId: { in: users.map((u) => u.id) } },
      select: { followingId: true },
    });
    followed = new Set(rows.map((r) => r.followingId));
  }
  return users.map((u) => ({ ...u, viewerFollows: followed.has(u.id) }));
}

const listSelect = { id: true, nickname: true, avatarUrl: true, totalLevel: true, isAdmin: true } as const;

/** userId 를 팔로우하는 사람들(팔로워). viewer 기준 맞팔 여부 포함. */
export async function getFollowers(userId: string, viewerId: string | null): Promise<FollowUserRow[]> {
  const rows = await prisma.follow.findMany({
    where: { followingId: userId },
    orderBy: { createdAt: "desc" },
    select: { follower: { select: listSelect } },
  });
  return decorateViewerFollows(rows.map((r) => r.follower), viewerId);
}

/** userId 가 팔로우하는 사람들(팔로잉). viewer 기준 맞팔 여부 포함. */
export async function getFollowing(userId: string, viewerId: string | null): Promise<FollowUserRow[]> {
  const rows = await prisma.follow.findMany({
    where: { followerId: userId },
    orderBy: { createdAt: "desc" },
    select: { following: { select: listSelect } },
  });
  return decorateViewerFollows(rows.map((r) => r.following), viewerId);
}
