/**
 * StorageService — 업로드 스토리지 추상화 (대규모 대비: base64 DB 저장 금지, URL/CDN 사용).
 * 어댑터 교체식:
 *  - local  : 로컬 디스크(public/uploads) — 클라우드 계정 없이 dev/테스트용
 *  - supabase: Supabase Storage(REST fetch, SDK 의존성 없음) — 운영
 * STORAGE_DRIVER 로 선택. supabase 선택 시 SUPABASE_URL/SUPABASE_SERVICE_KEY/SUPABASE_BUCKET 필요.
 */
import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";

export interface PutResult {
  url: string; // 공개 접근 URL (CDN)
  key: string; // 스토리지 내부 키 (삭제용)
}

export interface StorageService {
  put(key: string, data: Buffer, contentType: string): Promise<PutResult>;
  delete(key: string): Promise<void>;
}

// ── 로컬 디스크 (cwd/uploads, /api/uploads 라우트로 서빙) ──────
// next start 는 런타임에 추가된 public 파일을 서빙하지 않으므로 전용 라우트로 서빙한다.
export const LOCAL_UPLOAD_ROOT = path.join(process.cwd(), "uploads");

class LocalDiskStorage implements StorageService {
  async put(key: string, data: Buffer): Promise<PutResult> {
    const dest = path.join(LOCAL_UPLOAD_ROOT, key);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, data);
    return { url: `/api/uploads/${key}`, key };
  }
  async delete(key: string): Promise<void> {
    await unlink(path.join(LOCAL_UPLOAD_ROOT, key)).catch(() => {});
  }
}

// ── Supabase Storage (REST) ──────────────────────────────────
class SupabaseStorage implements StorageService {
  constructor(
    private baseUrl: string,
    private serviceKey: string,
    private bucket: string
  ) {}

  async put(key: string, data: Buffer, contentType: string): Promise<PutResult> {
    const res = await fetch(
      `${this.baseUrl}/storage/v1/object/${this.bucket}/${key}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.serviceKey}`,
          "content-type": contentType,
          "x-upsert": "true",
        },
        body: new Uint8Array(data),
      }
    );
    if (!res.ok) {
      throw new Error(`STORAGE_PUT_FAILED ${res.status} ${await res.text().catch(() => "")}`);
    }
    return {
      url: `${this.baseUrl}/storage/v1/object/public/${this.bucket}/${key}`,
      key,
    };
  }
  async delete(key: string): Promise<void> {
    await fetch(`${this.baseUrl}/storage/v1/object/${this.bucket}/${key}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${this.serviceKey}` },
    }).catch(() => {});
  }
}

let cached: StorageService | null = null;

export function getStorage(): StorageService {
  if (cached) return cached;
  const driver = process.env.STORAGE_DRIVER;
  if (driver === "supabase") {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    const bucket = process.env.SUPABASE_BUCKET || "media";
    if (url && key) {
      cached = new SupabaseStorage(url.replace(/\/$/, ""), key, bucket);
      return cached;
    }
    // 운영(NODE_ENV=production)에서 키 누락은 치명적 → 즉시 에러 (조용한 로컬 폴백 금지)
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "STORAGE_DRIVER=supabase 인데 SUPABASE_URL/SUPABASE_SERVICE_KEY 가 없습니다. (운영 설정 누락)"
      );
    }
    // 개발 편의: 로컬 디스크로 폴백
    console.warn("[storage] STORAGE_DRIVER=supabase 인데 키가 없어 로컬 디스크로 폴백 (dev)");
  }
  cached = new LocalDiskStorage();
  return cached;
}
