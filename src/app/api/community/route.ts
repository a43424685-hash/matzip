import { NextResponse } from "next/server";
import { getActiveUserId } from "@/lib/auth";
import { createCommunityPost } from "@/server/community/CommunityService";

export async function POST(req: Request) {
  const userId = await getActiveUserId();
  if (!userId) return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const r = await createCommunityPost(userId, {
    category: String(body.category ?? ""),
    title: String(body.title ?? ""),
    content: String(body.content ?? ""),
    imageUrls: Array.isArray(body.imageUrls) ? body.imageUrls.map(String) : [],
    videoUrl: body.videoUrl ? String(body.videoUrl) : null,
    videoThumbUrl: body.videoThumbUrl ? String(body.videoThumbUrl) : null,
  });
  if (!r.ok) return NextResponse.json({ ok: false, reason: r.reason }, { status: 400 });
  return NextResponse.json({ ok: true, id: r.id });
}
