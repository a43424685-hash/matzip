/**
 * Google Analytics 4 (GA4) 연결 헬퍼.
 * NEXT_PUBLIC_GA_ID(G-XXXXXXX) 가 설정돼 있을 때만 동작한다. (없으면 전부 no-op → 무해)
 * 핵심 퍼널(가입→등록→인증→구매)을 track() 으로 기록한다.
 */

// GA4 측정 ID. 측정 ID는 공개값(브라우저에 노출됨)이라 기본값으로 둬도 안전.
// 환경변수(NEXT_PUBLIC_GA_ID)가 있으면 그게 우선.
export const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? "G-PDKMDZ4SBF";

type GtagParams = Record<string, unknown>;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

function ready(): boolean {
  return !!GA_ID && typeof window !== "undefined" && typeof window.gtag === "function";
}

/** 페이지 조회 — 경로 바뀔 때마다 수동 전송 (SPA 라우팅) */
export function pageview(url: string): void {
  if (!ready()) return;
  window.gtag!("event", "page_view", { page_path: url });
}

/** 커스텀 이벤트 — 가입/등록/인증/구매 등 핵심 행동 */
export function track(event: string, params?: GtagParams): void {
  if (!ready()) return;
  window.gtag!("event", event, params ?? {});
}
