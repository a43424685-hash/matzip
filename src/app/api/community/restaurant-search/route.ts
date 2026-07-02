import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { searchRegisteredForAttach } from "@/server/community/CommunityService";

// 답변에 첨부할 등록 맛집 검색
export async function GET(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ results: [] });
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const results = await searchRegisteredForAttach(q);
  return NextResponse.json({ results });
}
