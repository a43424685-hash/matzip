"use client";

import { useEffect } from "react";

// 페이지 렌더 에러 경계 — 기본 Next.js 에러 화면 대신 원인을 보여주고 서버로 보고한다.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 서버 로그로 보고 (폰에서 난 에러를 PC에서 확인하기 위함)
    try {
      fetch("/api/client-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: error?.name,
          message: error?.message,
          digest: error?.digest,
          stack: error?.stack,
          url: typeof location !== "undefined" ? location.href : "",
          ua: typeof navigator !== "undefined" ? navigator.userAgent : "",
        }),
      }).catch(() => {});
    } catch {}

    // JS 청크 로딩 실패(터널 일시 끊김 등)면 1회 자동 새로고침으로 회복
    const msg = `${error?.name ?? ""} ${error?.message ?? ""}`;
    const isChunkError =
      error?.name === "ChunkLoadError" ||
      /Loading chunk|dynamically imported module|Importing a module script failed|Failed to fetch/i.test(msg);
    if (isChunkError) {
      try {
        if (!sessionStorage.getItem("chunkReloaded")) {
          sessionStorage.setItem("chunkReloaded", "1");
          location.reload();
          return;
        }
      } catch {
        location.reload();
        return;
      }
    } else {
      try {
        sessionStorage.removeItem("chunkReloaded");
      } catch {}
    }
  }, [error]);

  return (
    <main className="px-5 py-10">
      <h1 className="text-lg font-extrabold text-ink">문제가 발생했어요</h1>
      <p className="mt-1 text-sm text-ink-muted">잠시 후 다시 시도해주세요.</p>
      <pre className="mt-4 whitespace-pre-wrap break-all rounded-xl bg-stone-100 p-3 text-[12px] text-stone-600">
        {error?.name}: {error?.message}
        {error?.digest ? `\n\ndigest: ${error.digest}` : ""}
      </pre>
      <button
        type="button"
        onClick={reset}
        className="btn-primary mt-4 h-11 px-5"
      >
        다시 시도
      </button>
    </main>
  );
}
