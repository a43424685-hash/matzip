import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth";

// 네이티브 Google 로그인(안드로이드 Credential Manager)에서 받은 idToken을 검증하고 세션 발급.
// 토큰이 클라이언트(앱)에서 오므로 반드시 서명·발급자·대상(aud)을 검증한다.
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
// idToken의 aud = 서버(웹) OAuth 클라이언트 ID. 앱은 이 값을 serverClientId로 사용해 토큰을 받는다.
const GOOGLE_AUDIENCE = process.env.GOOGLE_WEB_CLIENT_ID || "";

export async function POST(req: Request) {
  const { idToken } = (await req.json().catch(() => ({}))) as { idToken?: string };
  if (!idToken) {
    return NextResponse.json({ ok: false, error: "no_token" }, { status: 400 });
  }
  if (!GOOGLE_AUDIENCE) {
    console.error("[google-native] GOOGLE_WEB_CLIENT_ID 미설정");
    return NextResponse.json({ ok: false, error: "server_misconfig" }, { status: 500 });
  }

  let sub: string | undefined;
  let emailClaim: string | undefined;
  let emailVerifiedClaim: boolean | string | undefined;
  try {
    const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
      // 구글은 두 형태의 iss를 발급함
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: GOOGLE_AUDIENCE,
    });
    sub = typeof payload.sub === "string" ? payload.sub : undefined;
    emailClaim = typeof payload.email === "string" ? payload.email : undefined;
    emailVerifiedClaim = payload.email_verified as boolean | string | undefined;
  } catch (e) {
    console.error("[google-native] 토큰 검증 실패", e);
    return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 401 });
  }

  if (!sub) return NextResponse.json({ ok: false, error: "no_sub" }, { status: 401 });
  const providerUserId = sub;

  const rawEmail = emailClaim?.trim().toLowerCase();
  const emailVerified = emailVerifiedClaim === true || emailVerifiedClaim === "true";
  const safeId = providerUserId.replace(/[^a-z0-9]/gi, "").slice(0, 24);
  const email = rawEmail && emailVerified ? rawEmail : `google-${safeId}@google.local`;
  const nickname = `구글-${randomUUID().slice(0, 8)}`;

  const user = await prisma.$transaction(async (tx) => {
    const account = await tx.authAccount.findUnique({
      where: { provider_providerUserId: { provider: "google", providerUserId } },
      select: { userId: true },
    });
    if (account) {
      await tx.user.update({
        where: { id: account.userId },
        data: { emailVerifiedAt: new Date(), deactivatedAt: null },
      });
      return tx.user.findUniqueOrThrow({ where: { id: account.userId }, select: { id: true } });
    }
    const existing = await tx.user.findUnique({ where: { email }, select: { id: true } });
    const createdOrExisting =
      existing ??
      (await tx.user.create({
        data: {
          email,
          nickname,
          passwordHash: `oauth:google:${randomUUID()}`,
          emailVerifiedAt: new Date(),
        },
        select: { id: true },
      }));
    await tx.authAccount.create({
      data: { userId: createdOrExisting.id, provider: "google", providerUserId, email },
    });
    return createdOrExisting;
  });

  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
