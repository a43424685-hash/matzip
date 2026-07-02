import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession, makeExchangeToken } from "@/lib/auth";
import { makeAppleClientSecret, decodeAppleIdToken } from "@/lib/appleAuth";

interface AppleTokenResponse {
  id_token?: string;
  error?: string;
}

function appBase(req: Request): string {
  return (process.env.APP_URL || new URL(req.url).origin).replace(/\/$/, "");
}

// Apple은 name/email scope일 때 결과를 POST(form_post)로 보낸다.
// POST→내부 페이지 이동은 303(See Other)으로 GET 전환해야 함.
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const code = form?.get("code")?.toString();
  const stateRaw = form?.get("state")?.toString() || "";
  const native = stateRaw.startsWith("native:");
  const rt = native ? stateRaw.slice("native:".length) : stateRaw;
  const returnTo = rt.startsWith("/") && !rt.startsWith("//") ? rt : "/";

  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/login?error=${reason}`, req.url), 303);

  if (!code) return fail("apple_failed");

  const clientId = process.env.APPLE_CLIENT_ID;
  if (!clientId) return fail("apple_not_configured");
  const redirectUri = process.env.APPLE_REDIRECT_URI || `${appBase(req)}/api/auth/apple/callback`;

  let clientSecret: string;
  try {
    clientSecret = makeAppleClientSecret();
  } catch (e) {
    console.error("[apple] client_secret 생성 실패", e);
    return fail("apple_failed");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const tokenRes = await fetch("https://appleid.apple.com/auth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const token = (await tokenRes.json().catch(() => ({}))) as AppleTokenResponse;
  if (!tokenRes.ok || !token.id_token) {
    console.error("[apple] token 교환 실패", { status: tokenRes.status, body: token });
    return fail("apple_failed");
  }

  const claims = decodeAppleIdToken(token.id_token);
  const providerUserId = claims.sub;
  if (!providerUserId) return fail("apple_failed");

  // 이메일은 최초 동의 시에만 옴. 'Hide My Email' 릴레이 주소도 그대로 저장.
  const rawEmail = claims.email?.trim().toLowerCase();
  const emailVerified = claims.email_verified === true || claims.email_verified === "true";
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
          passwordHash: `oauth:apple:${randomUUID()}`,
          emailVerifiedAt: new Date(),
        },
        select: { id: true, nicknameConfirmedAt: true },
      }));

    await tx.authAccount.create({
      data: {
        userId: createdOrExisting.id,
        provider: "apple",
        providerUserId,
        email,
      },
    });
    return createdOrExisting;
  });

  // 네이티브: 쿠키 대신 교환 토큰을 딥링크로 앱에 넘긴다 (앱이 WebView에서 세션 발급)
  if (native) {
    const tok = makeExchangeToken(user.id);
    return new NextResponse(null, {
      status: 303,
      headers: { Location: `mukgopin://auth?token=${encodeURIComponent(tok)}` },
    });
  }
  await createSession(user.id);
  if (!user.nicknameConfirmedAt) {
    return NextResponse.redirect(new URL("/onboarding", req.url), 303);
  }
  return NextResponse.redirect(new URL(returnTo, req.url), 303);
}
