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
  // 마지막 로그인 시각 기록 (휴면·이상탐지 지표). 실패해도 로그인은 진행.
  await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } }).catch(() => {});
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

// ── 네이티브 앱 로그인용 1회성 교환 토큰 ──────────────────────────
// Safari View Controller에서 OAuth 완료 후, 쿠키 대신 짧은 수명의 서명 토큰을
// 딥링크(mukgopin://)로 앱에 넘긴다. 앱은 이 토큰을 /api/auth/exchange 로 보내
// WebView 안에서 진짜 세션 쿠키를 발급받는다. (2분 만료)
const EXCHANGE_MAX_AGE = 120;

export function makeExchangeToken(userId: string): string {
  const exp = Math.floor(Date.now() / 1000) + EXCHANGE_MAX_AGE;
  const payload = `${userId}~${exp}`;
  return `${payload}~${sign(payload)}`;
}

export function verifyExchangeToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const parts = token.split("~");
  if (parts.length !== 3) return null;
  const [userId, expStr, sig] = parts;
  const expected = sign(`${userId}~${expStr}`);
  if (sig.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Math.floor(Date.now() / 1000) > exp) return null;
  return userId;
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
  legalName: string | null;
  isAdmin: boolean;
  role: string;
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
      legalName: true,
      isAdmin: true,
      role: true,
      suspendedAt: true,
    },
  });
  // 운영자에게 정지당한 계정은 이용 차단 → 안내 화면으로.
  if (user && user.suspendedAt) {
    redirect("/suspended");
  }
  // 가입 온보딩 — 닉네임/실명 미완이면 한 화면(/onboarding)에서 한 번에 (기존 가입자 포함)
  if (user && (!user.nicknameConfirmedAt || !user.legalName)) {
    redirect("/onboarding");
  }
  return user;
}

/** API 라우트용 — 리다이렉트 없이 로그인 사용자 id + 운영자 여부 + 역할(RBAC) */
export async function getSessionAdmin(): Promise<{ id: string; isAdmin: boolean; role: string } | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isAdmin: true, role: true },
  });
}
