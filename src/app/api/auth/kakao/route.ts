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
  // 로그인 후 돌아갈 내부 경로를 state로 전달 (외부 URL 차단 — 내부 절대경로만)
  const sp = new URL(req.url).searchParams;
  const returnToRaw = sp.get("returnTo") || "";
  const returnTo = returnToRaw.startsWith("/") && !returnToRaw.startsWith("//") ? returnToRaw : "";
  // 네이티브 앱(Safari View Controller) 흐름이면 state에 표시 → 콜백이 딥링크로 응답
  const native = sp.get("native") === "1";
  const stateVal = native ? `native:${returnTo}` : returnTo;

  const u = new URL("https://kauth.kakao.com/oauth/authorize");
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "profile_nickname account_email");
  if (stateVal) u.searchParams.set("state", stateVal);

  return NextResponse.redirect(u);
}
