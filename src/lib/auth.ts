/**
 * 간단 세션 인증 (MVP).
 *  - 비밀번호는 bcrypt 해시.
 *  - 세션은 HMAC 서명된 쿠키(userId)로 유지. (NextAuth 등은 향후 도입)
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

const COOKIE_NAME = "matzip_session";
// 운영에서 AUTH_SECRET 미설정이면 세션 위조가 가능하므로 즉시 막는다(개발용 fallback 금지).
const SECRET = (() => {
  const s = process.env.AUTH_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET 환경변수가 설정되지 않았습니다. 운영 배포 전 반드시 설정하세요.");
  }
  return "dev-only-secret";
})();
const MAX_AGE = 60 * 60 * 24 * 30; // 30일

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

function sign(value: string): string {
  return createHmac("sha256", SECRET).update(value).digest("base64url");
}

function makeToken(userId: string): string {
  return `${userId}.${sign(userId)}`;
}

function parseToken(token: string | undefined): string | null {
  if (!token) return null;
  const idx = token.lastIndexOf(".");
  if (idx <= 0) return null;
  const userId = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = sign(userId);
  // 길이 다르면 timingSafeEqual 이 throw 하므로 먼저 비교
  if (sig.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  return userId;
}

export async function createSession(userId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, makeToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** 현재 로그인 userId (없으면 null) */
export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  return parseToken(store.get(COOKIE_NAME)?.value);
}

export interface SessionUser {
  id: string;
  email: string;
  nickname: string;
  avatarUrl: string | null;
  totalXp: number;
  totalLevel: number;
  nicknameConfirmedAt: Date | null;
  isAdmin: boolean;
}

/** 현재 로그인 사용자 (없으면 null) */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      nickname: true,
      avatarUrl: true,
      totalXp: true,
      totalLevel: true,
      nicknameConfirmedAt: true,
      isAdmin: true,
    },
  });
  if (user && !user.nicknameConfirmedAt) {
    redirect("/onboarding/nickname");
  }
  return user;
}

/** API 라우트용 — 리다이렉트 없이 로그인 사용자 id + 운영자 여부만 */
export async function getSessionAdmin(): Promise<{ id: string; isAdmin: boolean } | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isAdmin: true },
  });
}
