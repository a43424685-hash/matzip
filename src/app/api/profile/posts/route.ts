import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { getProfileGrid, PROFILE_GRID_PAGE, type ProfileGridTab } from "@/server/profile/ProfileGridService";

/** 프로필 그리드 다음 페이지 — 무한 스크롤용. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "MISSING_USER" }, { status: 400 });
  const tab: ProfileGridTab = searchParams.get("tab") === "verified" ? "verified" : "posts";
  const skip = Math.max(0, parseInt(searchParams.get("skip") ?? "0", 10) || 0);

  const viewerId = await getSessionUserId();
  const items = await getProfileGrid(userId, viewerId, tab, skip, PROFILE_GRID_PAGE);
  return NextResponse.json({ items, hasMore: items.length === PROFILE_GRID_PAGE });
}
