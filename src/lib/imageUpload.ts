/**
 * 클라이언트 이미지 업로드 — 폰에서 리사이즈(원본 표시용 + 썸네일)한 뒤 /api/upload 로 보내
 * 스토리지 URL 을 받는다. (DB엔 base64 안 들어감)
 */

/** 파일 → 긴 변 maxDim 으로 리사이즈한 JPEG data URL */
export async function resizeToDataUrl(
  file: File,
  maxDim: number,
  quality: number
): Promise<string> {
  const srcUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(new Error("read fail"));
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("img fail"));
    i.src = srcUrl;
  });
  let w = img.width;
  let h = img.height;
  if (w >= h && w > maxDim) {
    h = Math.round((h * maxDim) / w);
    w = maxDim;
  } else if (h > w && h > maxDim) {
    w = Math.round((w * maxDim) / h);
    h = maxDim;
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return srcUrl;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

export interface UploadedImage {
  url: string;
  thumbnailUrl: string | null;
}

/** 이미지 1장 업로드 → {url, thumbnailUrl} (스토리지 CDN URL) */
export async function uploadImage(
  file: File,
  prefix: "post" | "avatar" = "post"
): Promise<UploadedImage> {
  const [image, thumb] = await Promise.all([
    resizeToDataUrl(file, 1600, 0.82), // 표시용 원본
    resizeToDataUrl(file, 400, 0.7), // 피드 썸네일
  ]);
  const res = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image, thumb, prefix }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || "UPLOAD_FAILED");
  }
  return res.json();
}
