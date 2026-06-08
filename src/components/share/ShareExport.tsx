"use client";

import { useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toPng } from "html-to-image";
import { Share2, Download, ArrowLeft, Check } from "lucide-react";

/**
 * 공유 카드 추출/공유 공통 래퍼.
 * children 으로 받은 카드(외부 이미지 미사용 권장)를 PNG 로 추출해
 * 네이티브 공유(navigator.share files) 또는 이미지 저장.
 */
export default function ShareExport({
  pageTitle,
  pageSubtitle,
  filename,
  shareTitle,
  shareText,
  cardWidth,
  cardHeight,
  children,
}: {
  pageTitle: string;
  pageSubtitle: string;
  filename: string;
  shareTitle: string;
  shareText: string;
  cardWidth: number;
  cardHeight: number;
  children: ReactNode;
}) {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const scale = 320 / cardWidth;

  async function toBlob(): Promise<Blob | null> {
    if (!cardRef.current) return null;
    const dataUrl = await toPng(cardRef.current, { pixelRatio: 3, cacheBust: true });
    const res = await fetch(dataUrl);
    return res.blob();
  }

  function download(blob: Blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onShare() {
    setBusy(true);
    setDone(null);
    try {
      const blob = await toBlob();
      if (!blob) return;
      const file = new File([blob], "matzip.png", { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: shareTitle, text: shareText });
        setDone("공유 완료");
      } else {
        download(blob);
        setDone("이미지를 저장했어요");
      }
    } catch {
      // 사용자가 취소
    } finally {
      setBusy(false);
    }
  }

  async function onDownload() {
    setBusy(true);
    setDone(null);
    try {
      const blob = await toBlob();
      if (blob) {
        download(blob);
        setDone("이미지를 저장했어요");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="px-5 py-5">
      <button
        onClick={() => router.back()}
        className="mb-4 flex items-center gap-1 text-sm text-ink-muted"
      >
        <ArrowLeft size={16} /> 뒤로
      </button>

      <h1 className="mb-1 text-xl font-extrabold text-ink">{pageTitle}</h1>
      <p className="mb-5 text-sm text-ink-muted">{pageSubtitle}</p>

      <div className="flex justify-center">
        <div
          className="overflow-hidden rounded-3xl shadow-lg"
          style={{ width: 320, height: Math.round(cardHeight * scale) }}
        >
          <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
            <div ref={cardRef}>{children}</div>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-2.5">
        <button onClick={onShare} disabled={busy} className="btn-primary h-12 w-full !text-base">
          <Share2 size={18} /> {busy ? "준비 중…" : "공유하기"}
        </button>
        <button onClick={onDownload} disabled={busy} className="btn-outline h-12 w-full !text-base">
          <Download size={18} /> 이미지 저장
        </button>
        {done && (
          <p className="flex items-center justify-center gap-1 pt-1 text-sm font-semibold text-forest">
            <Check size={15} /> {done}
          </p>
        )}
      </div>
    </main>
  );
}
