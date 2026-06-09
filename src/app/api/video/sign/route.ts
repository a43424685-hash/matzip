import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSessionUserId } from "@/lib/auth";
import { getStorage } from "@/server/storage/StorageService";

const ALLOWED_TYPES: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

/**
 * 영상 업로드용 서명 URL 발급.
 * - supabase: 브라우저가 직접 올릴 서명 URL 반환 (Vercel 4.5MB 본문 제한 우회)
 * - local(dev): 서명 미지원 → mode:"local" (클라가 /api/video/upload 로 업로드)
 */
export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const contentType = String(body.contentType ?? "");
  const ext = ALLOWED_TYPES[contentType];
  if (!ext) {
    return NextResponse.json({ error: "BAD_TYPE", allowed: Object.keys(ALLOWED_TYPES) }, { status: 400 });
  }

  const key = `posts/videos/${randomUUID()}.${ext}`;
  const storage = getStorage();

  if (storage.createSignedUpload) {
    try {
      const { uploadUrl, publicUrl } = await storage.createSignedUpload(key);
      return NextResponse.json({ mode: "signed", uploadUrl, publicUrl });
    } catch (e) {
      console.error("[video/sign]", e instanceof Error ? e.message : e);
      return NextResponse.json({ error: "SIGN_FAILED" }, { status: 500 });
    }
  }
  // local 개발 폴백
  return NextResponse.json({ mode: "local", key });
}
