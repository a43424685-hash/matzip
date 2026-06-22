import type { ReactElement } from "react";

// OG 이미지 표준 사이즈
export const OG_SIZE = { width: 1200, height: 630 };

// 한글 렌더용 폰트(Pretendard) — satori는 woff2 미지원이라 otf 사용. 모듈 캐시.
let fontCache: Promise<ArrayBuffer | null> | null = null;
export function loadOgFont(): Promise<ArrayBuffer | null> {
  if (!fontCache) {
    fontCache = fetch(
      "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/public/static/Pretendard-Bold.otf"
    )
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .catch(() => null);
  }
  return fontCache;
}

export async function ogFonts() {
  const data = await loadOgFont();
  return data ? [{ name: "Pretendard", data, weight: 700 as const, style: "normal" as const }] : [];
}

/** 공통 브랜드 카드 프레임 (딥그린 배경 + 먹고핀 로고 + 본문) */
export function OgFrame({
  badge,
  title,
  subtitle,
}: {
  badge?: string;
  title: string;
  subtitle?: string;
}): ReactElement {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#1f4d3f",
        color: "#ffffff",
        padding: "72px",
        fontFamily: "Pretendard",
      }}
    >
      <div style={{ display: "flex", fontSize: 40, fontWeight: 700 }}>
        <span>먹고</span>
        <span style={{ color: "#f2553f" }}>핀</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {badge ? (
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              background: "rgba(255,255,255,0.15)",
              borderRadius: 999,
              padding: "8px 20px",
              fontSize: 28,
            }}
          >
            {badge}
          </div>
        ) : null}
        <div style={{ display: "flex", fontSize: 72, fontWeight: 700, lineHeight: 1.1 }}>{title}</div>
        {subtitle ? (
          <div style={{ display: "flex", fontSize: 34, color: "rgba(255,255,255,0.82)" }}>{subtitle}</div>
        ) : null}
      </div>
      <div style={{ display: "flex", fontSize: 26, color: "rgba(255,255,255,0.65)" }}>
        먹고 핀 꽂고, 나만의 맛집 지도를 키워요
      </div>
    </div>
  );
}
