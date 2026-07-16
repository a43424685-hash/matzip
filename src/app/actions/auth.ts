"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { allowRate, clientIp } from "@/lib/rateLimit";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  createSession,
  destroySession,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";
import { nicknameSchema } from "@/lib/nickname";

const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email("이메일 형식이 올바르지 않습니다."),
  nickname: nicknameSchema,
  password: z.string().min(6, "비밀번호는 6자 이상이어야 합니다."),
  confirmPassword: z.string().min(1, "비밀번호 확인을 입력해주세요."),
}).refine((v) => v.password === v.confirmPassword, {
  message: "비밀번호가 서로 다릅니다.",
  path: ["confirmPassword"],
});

export type AuthState = { error?: string; devVerifyUrl?: string } | undefined;

export async function signupAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    nickname: formData.get("nickname"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }
  const { email, nickname, password } = parsed.data;

  // 가입 스팸 방어 — 같은 IP에서 1시간에 5계정 초과 차단
  const hs = await headers();
  if (!allowRate(`signup:${clientIp(hs)}`, 5, 3_600_000)) {
    return { error: "가입 시도가 너무 많아요. 잠시 후 다시 시도해주세요." };
  }

  // 이메일은 중복 불가(unique). 같은 이메일이면 가입 막음.
  const exists = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (exists) return { error: "이미 가입된 이메일입니다." };

  let user: { id: string };
  try {
    user = await prisma.user.create({
      data: {
        email,
        nickname,
        passwordHash: await hashPassword(password),
        nicknameConfirmedAt: new Date(),
        termsAgreedAt: new Date(), // 가입 폼의 약관·무관용 정책 동의 체크(필수)

        // 이메일 인증 없이 바로 가입 (도메인 발송 준비되면 인증 재도입)
        emailVerifiedAt: new Date(),
      },
      select: { id: true },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = Array.isArray(e.meta?.target) ? e.meta.target.join(",") : "";
      if (target.includes("nickname")) {
        return { error: "이미 사용 중인 닉네임입니다." };
      }
      return { error: "이미 가입된 이메일입니다." };
    }
    throw e;
  }

  // 가입 즉시 로그인 (?signup=1 → 홈에서 가입 완료 이벤트 1회 기록 후 제거)
  await createSession(user.id);
  redirect("/?signup=1");
}

export async function loginAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  // 폰 키보드 자동 대문자/공백 대비: 이메일은 trim + 소문자로 정규화
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  // 브루트포스 방어 — IP 단위(분당 20회) + 계정 단위 잠금(연속 10회 실패 → 10분)
  const hs = await headers();
  if (!allowRate(`login:${clientIp(hs)}`, 20, 60_000)) {
    return { error: "시도가 너무 많아요. 잠시 후 다시 시도해주세요." };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (user?.loginLockedUntil && user.loginLockedUntil > new Date()) {
    return { error: "로그인 시도가 너무 많아 잠시 잠겼어요. 10분 후 다시 시도해주세요." };
  }
  if (!user || user.deletedAt || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    if (user && !user.deletedAt) {
      const fails = user.loginFailCount + 1;
      await prisma.user.update({
        where: { id: user.id },
        data:
          fails >= 10
            ? { loginFailCount: 0, loginLockedUntil: new Date(Date.now() + 10 * 60_000) }
            : { loginFailCount: fails },
      });
    }
    return { error: "이메일 또는 비밀번호가 올바르지 않습니다." };
  }
  if (user.suspendedAt) {
    return { error: "운영정책 위반으로 정지된 계정이에요. 문의: chun8588@naver.com" };
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { loginFailCount: 0, loginLockedUntil: null, lastLoginAt: new Date(), deactivatedAt: null },
  });
  await createSession(user.id);
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/");
}
