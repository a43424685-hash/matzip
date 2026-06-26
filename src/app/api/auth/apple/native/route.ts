import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth";

// 네이티브 Apple 로그인(시트)에서 받은 identityToken을 검증하고 세션을 발급한다.
// 웹 OAuth와 달리 토큰이 클라이언트(앱)에서 오므로 반드시 서명·발급자·대상(aud)을 검증해야 함.
const APPLE_JWKS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));
// 네이티브 토큰의 aud = 앱 번들 ID (웹 서비스ID가 아님)
const APPLE_AUDIENCE = process.env.APPLE_BUNDLE_ID || "com.codebueok.mukgopin";

export async function POST(req: Request) {
  const { identityToken } = (await req.json().catch(() => ({}))) as { identityToken?: string };
  if (!identityToken) {
    return NextResponse.json({ ok: false, error: "no_token" }, { status: 400 });
  }

  let sub: string | undefined;
  let emailClaim: string | undefined;
  let emailVerifiedClaim: boolean | string | undefined;
  try {
    const { payload } = await jwtVerify(identityToken, APPLE_JWKS, {
      issuer: "https://appleid.apple.com",
      audience: APPLE_AUDIENCE,
    });
    sub = typeof payload.sub === "string" ? payload.sub : undefined;
    emailClaim = typeof payload.email === "string" ? payload.email : undefined;
    emailVerifiedClaim = payload.email_verified as boolean | string | undefined;
  } catch (e) {
    console.error("[apple-native] 토큰 검증 실패", e);
    return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 401 });
  }

  if (!sub) return NextResponse.json({ ok: false, error: "no_sub" }, { status: 401 });
  const providerUserId = sub;

  const rawEmail = emailClaim?.trim().toLowerCase();
  const emailVerified = emailVerifiedClaim === true || emailVerifiedClaim === "true";
  const safeId = providerUserId.replace(/[^a-z0-9]/gi, "").slice(0, 24);
  const email = rawEmail && emailVerified ? rawEmail : `apple-${safeId}@apple.local`;
  const nickname = `애플-${randomUUID().slice(0, 8)}`;

  const user = await prisma.$transaction(async (tx) => {
    const account = await tx.authAccount.findUnique({
      where: { provider_providerUserId: { provider: "apple", providerUserId } },
      select: { userId: true },
    });
    if (account) {
      await tx.user.update({
        where: { id: account.userId },
        data: { emailVerifiedAt: new Date(), deactivatedAt: null },
      });
      return tx.user.findUniqueOrThrow({
        where: { id: account.userId },
        select: { id: true },
      });
    }
    const existing = await tx.user.findUnique({ where: { email }, select: { id: true } });
    const createdOrExisting =
      existing ??
      (await tx.user.create({
        data: {
          email,
          nickname,
          passwordHash: `oauth:apple:${randomUUID()}`,
          emailVerifiedAt: new Date(),
        },
        select: { id: true },
      }));
    await tx.authAccount.create({
      data: { userId: createdOrExisting.id, provider: "apple", providerUserId, email },
    });
    return createdOrExisting;
  });

  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
