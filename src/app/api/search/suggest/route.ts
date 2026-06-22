import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * 검색 자동완성 — 입력한 글자가 포함된 (글이 있는) 맛집 이름 최대 8개.
 * 클릭하면 그 이름으로 검색 실행.
 */
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 1) return NextResponse.json({ suggestions: [] });

  const rows = await prisma.restaurant.findMany({
    where: { name: { contains: q, mode: "insensitive" }, posts: { some: {} } },
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
