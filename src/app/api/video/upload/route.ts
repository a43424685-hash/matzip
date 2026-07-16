import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getActiveUserId } from "@/lib/auth";
import { getStorage } from "@/server/storage/StorageService";

const ALLOWED_TYPES: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};
const MAX_BYTES = 50 * 1024 * 1024; // 50MB

/**
 * 로컬(dev) 영상 업로드 — multipart. (운영은 서명 URL 직접 업로드를 쓰므로 이 경로 미사용)
 * Vercel serverless 본문 제한이 있어 운영에선 큰 영상이 막힐 수 있음 → 운영은 /api/video/sign 사용.
 */
export async function POST(req: Request) {
  const userId = await getActiveUserId();
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "NO_FILE" }, { status: 400 });
  }
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) return NextResponse.json({ error: "BAD_TYPE" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "TOO_LARGE" }, { status: 413 });

  const buf = Buffer.from(await file.arrayBuffer());
  const key = `posts/videos/${randomUUID()}.${ext}`;
  try {
    const r = await getStorage().put(key, buf, file.type);
    return NextResponse.json({ url: r.url });
  } catch (e) {
    console.error("[video/upload]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "UPLOAD_FAILED" }, { status: 500 });
  }
}
