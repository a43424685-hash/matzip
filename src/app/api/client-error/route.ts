import { NextResponse } from "next/server";

// 폰(특히 iOS 사파리) 클라이언트 렌더 에러를 서버 로그로 받아 디버깅한다.
// (개발/스테이징 용도 — 운영 전환 시 에러 추적 SaaS로 교체)
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  console.error("[CLIENT-ERROR]", JSON.stringify(body));
  return NextResponse.json({ ok: true });
}
