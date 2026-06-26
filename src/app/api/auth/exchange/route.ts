import { NextResponse } from "next/server";
import { createSession, verifyExchangeToken } from "@/lib/auth";

// 네이티브 앱이 딥링크로 받은 교환 토큰을 WebView 안에서 여기로 보낸다.
// → 토큰 검증 후 진짜 세션 쿠키를 (이 WebView에) 발급하고 홈으로 보낸다.
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  const userId = verifyExchangeToken(token);
  if (!userId) {
    return NextResponse.redirect(new URL("/login?error=exchange_failed", req.url));
  }
  await createSession(userId);
  return NextResponse.redirect(new URL("/", req.url));
}
