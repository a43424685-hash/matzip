import { NextResponse } from "next/server";
import { stateCookieName, newNonce, buildState, stateCookieOptions } from "@/lib/oauthState";

// 사용자를 Apple 로그인 페이지로 보낸다. (카카오 /api/auth/kakao 와 동일 패턴)
export async function GET(req: Request) {
  const clientId = process.env.APPLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(new URL("/login?error=apple_not_configured", req.url));
  }

  const base = (process.env.APP_URL || new URL(req.url).origin).replace(/\/$/, "");
  const redirectUri = process.env.APPLE_REDIRECT_URI || `${base}/api/auth/apple/callback`;

  // 로그인 후 돌아갈 내부 경로를 state로 전달 (외부 URL 차단 — 내부 절대경로만)
  const sp = new URL(req.url).searchParams;
  const returnToRaw = sp.get("returnTo") || "";
  const returnTo = returnToRaw.startsWith("/") && !returnToRaw.startsWith("//") ? returnToRaw : "";
  const native = sp.get("native") === "1";
  // CSRF 방어: 난수 nonce를 state와 쿠키에 함께 심어 콜백에서 대조 (로그인 CSRF 차단)
  const nonce = newNonce();
  const stateVal = buildState(nonce, native, returnTo);

  const u = new URL("https://appleid.apple.com/auth/authorize");
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("response_type", "code");
  // name/email scope를 요청하면 응답을 form_post 로 받아야 함(Apple 규칙)
  u.searchParams.set("response_mode", "form_post");
  u.searchParams.set("scope", "name email");
  u.searchParams.set("state", stateVal);

  const res = NextResponse.redirect(u);
  res.cookies.set(stateCookieName("apple"), nonce, stateCookieOptions(true)); // form_post → 교차출처
  return res;
}
