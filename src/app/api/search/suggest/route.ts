import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { visibleRestaurantPostFilter } from "@/server/visibility/PaidVisibility";

export const dynamic = "force-dynamic";

/**
 * 검색 자동완성 — 입력한 글자가 포함된, "볼 수 있는 공개 글이 있는" 맛집 이름 최대 8개.
 * 유료 잠금 글만 있는 음식점 이름은 새지 않는다.
 */
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 1) return NextResponse.json({ suggestions: [] });

  const viewerId = await getSessionUserId();
  const postsFilter = await visibleRestaurantPostFilter(viewerId);
  const rows = await prisma.restaurant.findMany({
    where: { name: { contains: q, mode: "insensitive" }, posts: postsFilter },
    select: { name: true },
    orderBy: { saveCount: "desc" },
    take: 16,
  });

  const seen = new Set<string>();
  const suggestions: string[] = [];
  for (const r of rows) {
    if (seen.has(r.name)) continue;
    seen.add(r.name);
    suggestions.push(r.name);
    if (suggestions.length >= 8) break;
  }
  return NextResponse.json({ suggestions });
}
