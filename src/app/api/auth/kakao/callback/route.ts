import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { createSession, makeExchangeToken } from "@/lib/auth";
import { stateCookieName, parseState, verifyNonce } from "@/lib/oauthState";

interface KakaoTokenResponse {
  access_token?: string;
  error?: string;
}

interface KakaoMeResponse {
  id: number;
  kakao_account?: {
    email?: string;
    is_email_verified?: boolean;
    profile?: { nickname?: string };
  };
  properties?: { nickname?: string };
}

function appBase(req: Request): string {
  return (process.env.APP_URL || new URL(req.url).origin).replace(/\/$/, "");
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const COOKIE = stateCookieName("kakao");
  // 모든 실패/성공 응답에서 1회용 state 쿠키를 반드시 삭제 (재사용 방지)
  const respond = (path: string, status = 307) => {
    const res = NextResponse.redirect(new URL(path, req.url), status);
    res.cookies.delete(COOKIE);
    return res;
  };

  // CSRF 검증: state 서명 유효 + nonce가 시작 시 심은 쿠키와 일치해야 함.
  // (검증 성공 즉시 쿠키를 소진하므로 이후 단계 실패해도 재사용 불가)
  const stateRaw = url.searchParams.get("state") || "";
  const parsed = parseState(stateRaw);
  const cookieNonce = (await cookies()).get(COOKIE)?.value;
  if (!parsed.valid || !verifyNonce(parsed.nonce, cookieNonce)) {
    return respond("/login?error=state_mismatch");
  }
  const { native, returnTo } = parsed;

  if (!code) return respond("/login?error=kakao_failed");

  const clientId = process.env.KAKAO_CLIENT_ID || process.env.KAKAO_REST_API_KEY;
  if (!clientId) {
    return respond("/login?error=kakao_not_configured");
  }
  const redirectUri =
    process.env.KAKAO_REDIRECT_URI || `${appBase(req)}/api/auth/kakao/callback`;

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    redirect_uri: redirectUri,
    code,
  });
  if (process.env.KAKAO_CLIENT_SECRET) {
    body.set("client_secret", process.env.KAKAO_CLIENT_SECRET);
  }

  const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded;charset=utf-8" },
    body,
  });
  const token = (await tokenRes.json().catch(() => ({}))) as KakaoTokenResponse;
  if (!tokenRes.ok || !token.access_token) {
    console.error("[kakao] token failed", {
      status: tokenRes.status,
      body: token,
      redirectUri,
      hasClientSecret: Boolean(process.env.KAKAO_CLIENT_SECRET),
    });
    return respond("/login?error=kakao_failed");
  }

  const meRes = await fetch("https://kapi.kakao.com/v2/user/me", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const me = (await meRes.json().catch(() => null)) as KakaoMeResponse | null;
  if (!meRes.ok || !me?.id) {
    console.error("[kakao] me failed", {
      status: meRes.status,
      body: me,
    });
    return respond("/login?error=kakao_failed");
  }

  const providerUserId = String(me.id);
  // 이메일 병합 안전장치: 카카오에서 '인증된' 이메일일 때만 기존 이메일 계정과 병합한다.
  // (미인증 이메일로 타인 계정에 들러붙는 계정 탈취 방지) — 미인증/없음이면 충돌 없는 로컬 이메일 사용.
  const rawEmail = me.kakao_account?.email?.trim().toLowerCase();
  const emailVerified = me.kakao_account?.is_email_verified === true && !!rawEmail;
  const email = emailVerified ? (rawEmail as string) : `kakao-${providerUserId}@kakao.local`;
  const nickname = `카카오${providerUserId}`;

  const user = await prisma.$transaction(async (tx) => {
    const account = await tx.authAccount.findUnique({
      where: { provider_providerUserId: { provider: "kakao", providerUserId } },
      select: { userId: true },
    });
    if (account) {
      await tx.user.update({
        where: { id: account.userId },
        data: { emailVerifiedAt: new Date(), deactivatedAt: null },
      });
      return tx.user.findUniqueOrThrow({
        where: { id: account.userId },
        select: { id: true, nicknameConfirmedAt: true },
      });
    }

    const existing = await tx.user.findUnique({
      where: { email },
      select: { id: true, nicknameConfirmedAt: true },
    });
    const createdOrExisting =
      existing ??
      (await tx.user.create({
        data: {
          email,
          nickname,
          passwordHash: `oauth:kakao:${randomUUID()}`,
          emailVerifiedAt: new Date(),
        },
        select: { id: true, nicknameConfirmedAt: true },
      }));

    await tx.authAccount.create({
      data: {
        userId: createdOrExisting.id,
        provider: "kakao",
        providerUserId,
        email,
      },
    });
    await tx.user.update({
      where: { id: createdOrExisting.id },
      data: { emailVerifiedAt: new Date() },
    });
    return createdOrExisting;
  });

  // 네이티브: 쿠키 대신 교환 토큰을 딥링크로 앱에 넘긴다 (앱이 WebView에서 세션 발급)
  if (native) {
    const tok = makeExchangeToken(user.id);
    const res = new NextResponse(null, {
      status: 303,
      headers: { Location: `mukgopin://auth?token=${encodeURIComponent(tok)}` },
    });
    res.cookies.delete(COOKIE);
    return res;
  }
  await createSession(user.id);
  const dest = user.nicknameConfirmedAt ? returnTo : "/onboarding";
  return respond(dest);
}
