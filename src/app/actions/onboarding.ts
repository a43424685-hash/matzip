"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { nicknameSchema } from "@/lib/nickname";

const formSchema = z.object({ nickname: nicknameSchema });

export type NicknameState = { error?: string } | undefined;

export async function confirmNicknameAction(
  _prev: NicknameState,
  formData: FormData
): Promise<NicknameState> {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const parsed = formSchema.safeParse({ nickname: formData.get("nickname") });
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        nickname: parsed.data.nickname,
        nicknameConfirmedAt: new Date(),
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "이미 사용 중인 닉네임입니다." };
    }
    throw e;
  }

  redirect("/");
}

const legalNameSchema = z
  .string()
  .trim()
  .min(2, "실명을 정확히 입력해주세요.")
  .max(20, "이름이 너무 길어요.")
  .regex(/^[가-힣a-zA-Z·\s]+$/, "한글 또는 영문 이름만 입력해주세요.");

export type LegalNameState = { error?: string } | undefined;

/** 실명 확정 — 한 번 설정하면 수정 불가(이미 있으면 그대로 통과). */
export async function confirmLegalNameAction(
  _prev: LegalNameState,
  formData: FormData
): Promise<LegalNameState> {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const parsed = legalNameSchema.safeParse(formData.get("legalName"));
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const existing = await prisma.user.findUnique({ where: { id: userId }, select: { legalName: true } });
  if (!existing?.legalName) {
    await prisma.user.update({ where: { id: userId }, data: { legalName: parsed.data } });
  }
  redirect("/");
}

// 닉네임 + 실명을 한 화면에서 한 번에 확정 (가입 온보딩 간소화).
export type ProfileSetupState = { error?: string } | undefined;

export async function confirmProfileAction(
  _prev: ProfileSetupState,
  formData: FormData
): Promise<ProfileSetupState> {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const nick = nicknameSchema.safeParse(formData.get("nickname"));
  if (!nick.success) return { error: nick.error.errors[0].message };
  const legal = legalNameSchema.safeParse(formData.get("legalName"));
  if (!legal.success) return { error: legal.error.errors[0].message };

  // 실명은 한 번 설정하면 수정 불가 → 이미 있으면 유지
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { legalName: true },
  });

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        nickname: nick.data,
        nicknameConfirmedAt: new Date(),
        ...(existing?.legalName ? {} : { legalName: legal.data }),
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "이미 사용 중인 닉네임입니다." };
    }
    throw e;
  }

  redirect("/");
}
