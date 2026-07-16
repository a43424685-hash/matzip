import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";
import { allowRate, clientIp } from "@/lib/rateLimit";

const LOCK_AFTER_FAILS = 10; // 연속 실패 10회 → 잠금
const LOCK_MINUTES = 10;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "로그인 정보를 다시 입력해주세요." },
      { status: 400 }
    );
  }

  const data = body as { email?: unknown; password?: unknown };
  const email = String(data.email ?? "").trim().toLowerCase();
  const password = String(data.password ?? "");

  if (!email || !password) {
    return NextResponse.json(
      { ok: false, error: "이메일과 비밀번호를 입력해주세요." },
      { status: 400 }
    );
  }

  // IP 단위 1차 방어 — 1분에 20회 초과 시도 차단
  if (!allowRate(`login:${clientIp(request.headers)}`, 20, 60_000)) {
    return NextResponse.json(
      { ok: false, error: "시도가 너무 많아요. 잠시 후 다시 시도해주세요." },
      { status: 429 }
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // 계정 단위 잠금 — 연속 실패 누적 시 일시 잠금 (비밀번호 대입 방어)
  if (user?.loginLockedUntil && user.loginLockedUntil > new Date()) {
    return NextResponse.json(
      { ok: false, error: "로그인 시도가 너무 많아 잠시 잠겼어요. 10분 후 다시 시도해주세요." },
      { status: 429 }
    );
  }

  if (!user || user.deletedAt || !(await verifyPassword(password, user.passwordHash))) {
    if (user && !user.deletedAt) {
      const fails = user.loginFailCount + 1;
      await prisma.user.update({
        where: { id: user.id },
        data:
          fails >= LOCK_AFTER_FAILS
            ? { loginFailCount: 0, loginLockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) }
            : { loginFailCount: fails },
      });
    }
    return NextResponse.json(
      { ok: false, error: "이메일 또는 비밀번호가 올바르지 않습니다." },
      { status: 401 }
    );
  }

  if (!user.emailVerifiedAt) {
    return NextResponse.json(
      { ok: false, error: "이메일 인증 후 로그인할 수 있습니다." },
      { status: 403 }
    );
  }

  if (user.suspendedAt) {
    return NextResponse.json(
      { ok: false, error: "운영정책 위반으로 정지된 계정이에요. 문의: chun8588@naver.com" },
      { status: 403 }
    );
  }

  // 성공 — 실패 카운트 리셋 + 비활성화 계정은 자동 복구 (쉬어가기 → 다시 활성)
  await prisma.user.update({
    where: { id: user.id },
    data: { loginFailCount: 0, loginLockedUntil: null, lastLoginAt: new Date(), deactivatedAt: null },
  });

  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
