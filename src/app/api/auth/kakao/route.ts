import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const clientId = process.env.KAKAO_CLIENT_ID || process.env.KAKAO_REST_API_KEY;
  if (!clientId) {
    return NextResponse.redirect(new URL("/login?error=kakao_not_configured", req.url));
  }

  const base = process.env.APP_URL || new URL(req.url).origin;
  const redirectUri =
    process.env.KAKAO_REDIRECT_URI ||
    `${base.replace(/\/$/, "")}/api/auth/kakao/callback`;
  const u = new URL("https://kauth.kakao.com/oauth/authorize");
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "profile_nickname account_email");

  return NextResponse.redirect(u);
}
