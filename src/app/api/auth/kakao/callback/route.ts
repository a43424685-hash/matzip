import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth";

interface KakaoTokenResponse {
  access_token?: string;
  error?: string;
}

interface KakaoMeResponse {
  id: number;
  kakao_account?: {
    email?: string;
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
  if (!code) return NextResponse.redirect(new URL("/login?error=kakao_failed", req.url));

  const clientId = process.env.KAKAO_CLIENT_ID || process.env.KAKAO_REST_API_KEY;
  if (!clientId) {
    return NextResponse.redirect(new URL("/login?error=kakao_not_configured", req.url));
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
    return NextResponse.redirect(new URL("/login?error=kakao_failed", req.url));
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
    return NextResponse.redirect(new URL("/login?error=kakao_failed", req.url));
  }

  const providerUserId = String(me.id);
  const email = me.kakao_account?.email?.trim().toLowerCase() || `kakao-${providerUserId}@kakao.local`;
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

  await createSession(user.id);
  if (!user.nicknameConfirmedAt) {
    return NextResponse.redirect(new URL("/onboarding/nickname", req.url));
  }
  return NextResponse.redirect(new URL("/", req.url));
}
