"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionUserId, destroySession } from "@/lib/auth";
import {
  updateNickname,
  updateAvatar,
  deactivateAccount,
  deleteAccount,
} from "@/server/account/AccountService";

const bankSchema = z.object({
  bankName: z.string().trim().min(1, "은행을 입력해주세요."),
  accountNumber: z
    .string()
    .trim()
    .regex(/^[0-9-]{6,20}$/, "계좌번호를 정확히 입력해주세요 (숫자/‘-’)."),
  accountHolder: z.string().trim().min(2, "예금주명을 입력해주세요."),
});

export type BankState = { error?: string } | undefined;

/** 정산 계좌 등록/수정 — 예금주명은 가입 시 등록한 실명과 일치해야 함. */
export async function saveBankAccountAction(_prev: BankState, formData: FormData): Promise<BankState> {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const parsed = bankSchema.safeParse({
    bankName: formData.get("bankName"),
    accountNumber: formData.get("accountNumber"),
    accountHolder: formData.get("accountHolder"),
  });
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { legalName: true } });
  if (!user?.legalName) return { error: "먼저 실명을 등록해주세요." };

  const norm = (s: string) => s.replace(/\s+/g, "");
  if (norm(parsed.data.accountHolder) !== norm(user.legalName)) {
    return { error: "예금주명이 본인 실명과 일치해야 등록할 수 있어요." };
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      bankName: parsed.data.bankName,
      accountNumber: parsed.data.accountNumber,
      accountHolder: parsed.data.accountHolder,
    },
  });
  redirect("/me/earnings");
}

export type ProfileState = { ok?: boolean; error?: string } | undefined;

export async function updateProfileAction(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const avatarUrl = String(formData.get("avatarUrl") ?? "");
  await updateAvatar(userId, avatarUrl || null);

  const nickname = String(formData.get("nickname") ?? "").trim();
  if (nickname) {
    const r = await updateNickname(userId, nickname);
    if (!r.ok) return { error: r.reason };
  }
  return { ok: true };
}

export async function deactivateAction(): Promise<void> {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  await deactivateAccount(userId);
  await destroySession();
  redirect("/");
}

export async function deleteAccountAction(): Promise<void> {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  await deleteAccount(userId);
  await destroySession();
  redirect("/");
}
