import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth";

interface KakaoMeResponse {
  id: number;
  kakao_account?: {
    email?: string;
    is_email_verified?: boolean;
  };
}

// 네이티브 카카오 로그인(카톡앱)에서 받은 accessToken으로 카카오 사용자 정보를 조회하고 세션 발급.
export async function POST(req: Request) {
  const { accessToken } = (await req.json().catch(() => ({}))) as { accessToken?: string };
  if (!accessToken) {
    return NextResponse.json({ ok: false, error: "no_token" }, { status: 400 });
  }

  // 토큰이 '우리 앱'에서 발급됐는지 검증 — 다른 카카오 앱이 수집한 토큰의
  // 재생(confused deputy)으로 로그인되는 걸 막는다. KAKAO_APP_ID = 카카오 개발자
  // 콘솔의 숫자 앱 ID. 미설정이면 경고만 남기고 통과(설정 후 강제됨).
  const expectedAppId = process.env.KAKAO_APP_ID;
  const infoRes = await fetch("https://kapi.kakao.com/v1/user/access_token_info", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const info = (await infoRes.json().catch(() => null)) as { id?: number; app_id?: number } | null;
  if (!infoRes.ok || !info?.app_id) {
    console.error("[kakao-native] access_token_info 실패", { status: infoRes.status, body: info });
    return NextResponse.json({ ok: false, error: "token_invalid" }, { status: 401 });
  }
  if (expectedAppId) {
    if (String(info.app_id) !== expectedAppId.trim()) {
      console.error("[kakao-native] app_id 불일치 — 다른 앱의 토큰", { got: info.app_id });
      return NextResponse.json({ ok: false, error: "wrong_app" }, { status: 401 });
    }
  } else {
    console.warn("[kakao-native] KAKAO_APP_ID 미설정 — app_id 검증 생략 중. Vercel 환경변수에 추가 필요");
  }

  const meRes = await fetch("https://kapi.kakao.com/v2/user/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const me = (await meRes.json().catch(() => null)) as KakaoMeResponse | null;
  if (!meRes.ok || !me?.id) {
    console.error("[kakao-native] me 조회 실패", { status: meRes.status, body: me });
    return NextResponse.json({ ok: false, error: "me_failed" }, { status: 401 });
  }

  const providerUserId = String(me.id);
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
      return tx.user.findUniqueOrThrow({ where: { id: account.userId }, select: { id: true } });
    }
    const existing = await tx.user.findUnique({ where: { email }, select: { id: true } });
    const createdOrExisting =
      existing ??
      (await tx.user.create({
        data: {
          email,
          nickname,
          passwordHash: `oauth:kakao:${randomUUID()}`,
          emailVerifiedAt: new Date(),
        },
        select: { id: true },
      }));
    await tx.authAccount.create({
      data: { userId: createdOrExisting.id, provider: "kakao", providerUserId, email },
    });
    return createdOrExisting;
  });

  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
