import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * 클라이언트가 마지막으로 본 시점(since, ms) 이후 내 XP 이벤트 + 현재 레벨을 반환.
 * 어떤 경로로 XP가 적립됐든(등록/인증/좋아요 등) XpEvent에 남으므로 전부 잡힌다.
 * 토스트(경험치 획득/레벨업)용. level=null 이면 비로그인.
 */
export async function GET(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ cursor: Date.now(), level: null, events: [] });
  }
  const sinceParam = Number(new URL(req.url).searchParams.get("since") ?? "0");
  const since = Number.isFinite(sinceParam) && sinceParam > 0 ? new Date(sinceParam) : null;

  const [user, events] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { totalLevel: true } }),
    since
      ? prisma.xpEvent.findMany({
          where: { userId, createdAt: { gt: since } },
          orderBy: { createdAt: "asc" },
          take: 30,
          select: { xpAmount: true, sourceType: true, createdAt: true },
        })
      : Promise.resolve([]),
  ]);

  const mapped = events.map((e) => ({ amount: e.xpAmount, source: e.sourceType, at: e.createdAt.getTime() }));
  const cursor = mapped.length ? mapped[mapped.length - 1].at : Date.now();
  return NextResponse.json({ cursor, level: user?.totalLevel ?? null, events: mapped });
}
