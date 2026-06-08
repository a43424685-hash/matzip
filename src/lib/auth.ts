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
const SECRET = process.env.AUTH_SECRET ?? "dev-only-secret";
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
    },
  });
  if (user && !user.nicknameConfirmedAt) {
    redirect("/onboarding/nickname");
  }
  return user;
}
