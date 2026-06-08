"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  createSession,
  destroySession,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";
import {
  buildVerificationUrl,
  createEmailVerificationToken,
} from "@/server/auth/EmailVerificationService";
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

  const exists = await prisma.user.findUnique({
    where: { email },
    select: { id: true, emailVerifiedAt: true },
  });
  if (exists?.emailVerifiedAt) return { error: "이미 가입된 이메일입니다." };
  if (exists && !exists.emailVerifiedAt) {
    const { token } = await createEmailVerificationToken(exists.id);
    const url = buildVerificationUrl(token);
    console.log(`[auth] 이메일 인증 링크 재발급: ${url}`);
    const dev = process.env.NODE_ENV !== "production"
      ? `&devUrl=${encodeURIComponent(url)}`
      : "";
    redirect(`/verify-email/sent?email=${encodeURIComponent(email)}${dev}`);
  }

  let user: { id: string };
  try {
    user = await prisma.user.create({
      data: {
        email,
        nickname,
        passwordHash: await hashPassword(password),
        nicknameConfirmedAt: new Date(),
      },
      select: { id: true },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = Array.isArray(e.meta?.target) ? e.meta.target.join(",") : "";
      if (target.includes("nickname")) {
        return { error: "이미 사용 중인 닉네임입니다." };
      }
      const existing = await prisma.user.findUnique({
        where: { email },
        select: { id: true, emailVerifiedAt: true },
      });
      if (existing && !existing.emailVerifiedAt) {
        const { token } = await createEmailVerificationToken(existing.id);
        const url = buildVerificationUrl(token);
        console.log(`[auth] 이메일 인증 링크 재발급: ${url}`);
        const dev = process.env.NODE_ENV !== "production"
          ? `&devUrl=${encodeURIComponent(url)}`
          : "";
        redirect(`/verify-email/sent?email=${encodeURIComponent(email)}${dev}`);
      }
      return { error: "이미 가입된 이메일입니다." };
    }
    throw e;
  }
  const { token } = await createEmailVerificationToken(user.id);
  const url = buildVerificationUrl(token);
  console.log(`[auth] 이메일 인증 링크: ${url}`);

  const dev = process.env.NODE_ENV !== "production"
    ? `&devUrl=${encodeURIComponent(url)}`
    : "";
  redirect(`/verify-email/sent?email=${encodeURIComponent(email)}${dev}`);
}

export async function loginAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  // 폰 키보드 자동 대문자/공백 대비: 이메일은 trim + 소문자로 정규화
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "이메일 또는 비밀번호가 올바르지 않습니다." };
  }
  if (!user.emailVerifiedAt) {
    return { error: "이메일 인증 후 로그인할 수 있습니다." };
  }
  await createSession(user.id);
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/");
}
