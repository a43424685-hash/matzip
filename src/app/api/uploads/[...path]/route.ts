import { readFile } from "fs/promises";
import path from "path";
import { LOCAL_UPLOAD_ROOT } from "@/server/storage/StorageService";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

/** 로컬 디스크 스토리지(dev) 파일 서빙. (운영 supabase 는 자체 CDN URL 사용) */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: parts } = await params;
  // 경로 이탈 방지: resolve 후 root 기준 상대경로가 ".."로 시작하거나 절대경로면 거부
  // (startsWith 문자열 검사는 uploads2 같은 형제 경로를 통과시켜서 안 됨)
  const full = path.resolve(LOCAL_UPLOAD_ROOT, parts.join("/"));
  const relToRoot = path.relative(LOCAL_UPLOAD_ROOT, full);
  if (relToRoot.startsWith("..") || path.isAbsolute(relToRoot)) {
    return new Response("forbidden", { status: 403 });
  }
  const ext = path.extname(full).toLowerCase();
  const type = MIME[ext];
  if (!type) return new Response("not found", { status: 404 });
  try {
    const buf = await readFile(full);
    return new Response(new Uint8Array(buf), {
      headers: {
        "content-type": type,
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
