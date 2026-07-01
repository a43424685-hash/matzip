import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { getFollowers } from "@/server/follow/FollowService";
import FollowListScreen from "@/components/FollowListScreen";

export const dynamic = "force-dynamic";

export default async function FollowersPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const [target, viewerId] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { nickname: true } }),
    getSessionUserId(),
  ]);
  if (!target) notFound();
  const rows = await getFollowers(userId, viewerId);

  return (
    <FollowListScreen
      targetUserId={userId}
      targetNickname={target.nickname}
      tab="followers"
      rows={rows}
      viewerId={viewerId}
    />
  );
}
