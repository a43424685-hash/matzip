import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSessionUserId } from "@/lib/auth";
import { getStorage } from "@/server/storage/StorageService";

// 데이터 URL 길이 상한 (클라가 리사이즈해서 보냄 — 악성 클라 토큰/용량 폭탄 방어)
const MAX_IMAGE_CHARS = 3_000_000; // ≈ 2.2MB
const MAX_THUMB_CHARS = 800_000; // ≈ 0.6MB
const ALLOWED = /^data:(image\/(jpeg|png|webp));base64,(.+)$/;

function parse(dataUrl: string): { mime: string; ext: string; buf: Buffer } | null {
  const m = dataUrl.match(ALLOWED);
  if (!m) return null;
  const ext = m[2] === "jpeg" ? "jpg" : m[2];
  return { mime: m[1], ext, buf: Buffer.from(m[3], "base64") };
}

/**
 * 이미지 업로드 — 클라가 리사이즈한 원본+썸네일 data URL 을 받아 스토리지에 저장하고 URL 반환.
 * (DB엔 절대 base64 저장하지 않음 — 여기서 스토리지로 보내고 URL만 돌려줌)
 */
export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const image = body.image as string;
  const thumb = body.thumb as string | undefined;
  const prefix = (body.prefix as string) === "avatar" ? "avatars" : "posts";

  if (typeof image !== "string" || !ALLOWED.test(image)) {
    return NextResponse.json({ error: "BAD_IMAGE" }, { status: 400 });
  }
  if (image.length > MAX_IMAGE_CHARS) {
    return NextResponse.json({ error: "IMAGE_TOO_LARGE" }, { status: 413 });
  }
  if (thumb && (thumb.length > MAX_THUMB_CHARS || !ALLOWED.test(thumb))) {
    return NextResponse.json({ error: "BAD_THUMB" }, { status: 400 });
  }

  const orig = parse(image)!;
  const storage = getStorage();
  const id = randomUUID();

  try {
    const main = await storage.put(`${prefix}/${id}.${orig.ext}`, orig.buf, orig.mime);
    let thumbnailUrl: string | null = null;
    if (thumb) {
      const t = parse(thumb);
      if (t) {
        const tr = await storage.put(`${prefix}/${id}_thumb.${t.ext}`, t.buf, t.mime);
        thumbnailUrl = tr.url;
      }
    }
    return NextResponse.json({ url: main.url, thumbnailUrl });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    return NextResponse.json({ error: "UPLOAD_FAILED", detail: msg }, { status: 500 });
  }
}
