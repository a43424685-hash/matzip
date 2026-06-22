import { ImageResponse } from "next/og";
import { OG_SIZE, ogFonts, OgFrame } from "@/lib/og";

export const runtime = "nodejs";
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "먹고핀 — 먹고 핀 꽂고, 나만의 맛집 지도";

export default async function Image() {
  return new ImageResponse(
    <OgFrame title="진짜 맛집만, 먹고핀" subtitle="가서 인증하고 레벨업하는 맛집 지도" />,
    { ...size, fonts: await ogFonts() }
  );
}
