import { NextResponse } from "next/server";
import { OAUTH_STATE_COOKIE, newNonce, buildState, stateCookieOptions } from "@/lib/oauthState";

export async function GET(req: Request) {
  const clientId = process.env.KAKAO_CLIENT_ID || process.env.KAKAO_REST_API_KEY;
  if (!clientId) {
    return NextResponse.redirect(new URL("/login?error=kakao_not_configured", req.url));
  }

  const base = process.env.APP_URL || new URL(req.url).origin;
  const redirectUri =
    process.env.KAKAO_REDIRECT_URI ||
    `${base.replace(/\/$/, "")}/api/auth/kakao/callback`;
  // 로그인 후 돌아갈 내부 경로를 state로 전달 (외부 URL 차단 — 내부 절대경로만)
  const sp = new URL(req.url).searchParams;
  const returnToRaw = sp.get("returnTo") || "";
  const returnTo = returnToRaw.startsWith("/") && !returnToRaw.startsWith("//") ? returnToRaw : "";
  const native = sp.get("native") === "1";
  // CSRF 방어: 난수 nonce를 state와 쿠키에 함께 심어 콜백에서 대조 (로그인 CSRF 차단)
  const nonce = newNonce();
  const stateVal = buildState(nonce, native, returnTo);

  const u = new URL("https://kauth.kakao.com/oauth/authorize");
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "profile_nickname account_email");
  u.searchParams.set("state", stateVal);

  const res = NextResponse.redirect(u);
  res.cookies.set(OAUTH_STATE_COOKIE, nonce, stateCookieOptions());
  return res;
}
