/**
 * 영상 업로드 (브라우저).
 *  1) 첫 프레임으로 포스터 썸네일 + 길이 추출
 *  2) 서명 URL 받아 Supabase 로 직접 업로드 (Vercel 4.5MB 본문 제한 우회)
 *     - 로컬(dev): 서명 미지원이면 /api/video/upload(multipart) 폴백
 *  3) 포스터는 기존 이미지 업로드 경로로 저장
 */
export interface VideoUploadResult {
  url: string;
  thumbnailUrl: string | null;
  duration: number | null;
}

export const VIDEO_MAX_BYTES = 50 * 1024 * 1024; // 50MB
export const VIDEO_MAX_DURATION = 60; // 초
const TYPE_OK = new Set(["video/mp4", "video/quicktime", "video/webm"]);

export async function uploadVideo(file: File): Promise<VideoUploadResult> {
  if (!TYPE_OK.has(file.type)) throw new Error("지원하지 않는 형식이에요 (mp4·mov·webm).");
  if (file.size > VIDEO_MAX_BYTES) throw new Error("영상이 너무 커요 (최대 50MB).");

  const meta = await capturePoster(file).catch(() => ({ posterDataUrl: null, duration: null }));
  if (meta.duration != null && meta.duration > VIDEO_MAX_DURATION + 1) {
    throw new Error(`영상이 너무 길어요 (최대 ${VIDEO_MAX_DURATION}초).`);
  }

  // 1) 서명 URL 요청
  const signRes = await fetch("/api/video/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType: file.type }),
  });
  if (!signRes.ok) throw new Error("업로드 준비에 실패했어요.");
  const sign = (await signRes.json()) as { mode: string; uploadUrl?: string; publicUrl?: string };

  // 2) 업로드
  let url: string;
  if (sign.mode === "signed" && sign.uploadUrl && sign.publicUrl) {
    const put = await fetch(sign.uploadUrl, {
      method: "PUT",
      headers: { "content-type": file.type, "x-upsert": "true" },
      body: file,
    });
    if (!put.ok) throw new Error("영상 업로드에 실패했어요.");
    url = sign.publicUrl;
  } else {
    const fd = new FormData();
    fd.append("file", file);
    const up = await fetch("/api/video/upload", { method: "POST", body: fd });
    if (!up.ok) throw new Error("영상 업로드에 실패했어요.");
    url = ((await up.json()) as { url: string }).url;
  }

  // 3) 포스터 썸네일 업로드 (실패해도 영상은 유효)
  let thumbnailUrl: string | null = null;
  if (meta.posterDataUrl) {
    const tr = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: meta.posterDataUrl, prefix: "post" }),
    }).catch(() => null);
    if (tr && tr.ok) thumbnailUrl = ((await tr.json()) as { url?: string }).url ?? null;
  }

  return { url, thumbnailUrl, duration: meta.duration };
}

function capturePoster(
  file: File
): Promise<{ posterDataUrl: string | null; duration: number | null }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    const objUrl = URL.createObjectURL(file);
    let duration: number | null = null;
    let done = false;
    const cleanup = () => URL.revokeObjectURL(objUrl);

    video.onloadedmetadata = () => {
      duration = isFinite(video.duration) ? Math.round(video.duration) : null;
      const t = Math.min(0.2, (video.duration || 1) / 2);
      video.currentTime = isFinite(t) ? t : 0;
    };
    video.onseeked = () => {
      if (done) return;
      done = true;
      try {
        const maxW = 640;
        const scale = video.videoWidth > maxW ? maxW / video.videoWidth : 1;
        const w = Math.max(1, Math.round(video.videoWidth * scale));
        const h = Math.max(1, Math.round(video.videoHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          cleanup();
          return resolve({ posterDataUrl: null, duration });
        }
        ctx.drawImage(video, 0, 0, w, h);
        const posterDataUrl = canvas.toDataURL("image/jpeg", 0.7);
        cleanup();
        resolve({ posterDataUrl, duration });
      } catch {
        cleanup();
        resolve({ posterDataUrl: null, duration });
      }
    };
    video.onerror = () => {
      cleanup();
      reject(new Error("영상을 읽지 못했어요."));
    };
    video.src = objUrl;
  });
}
