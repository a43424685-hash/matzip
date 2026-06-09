"use server";

import { redirect } from "next/navigation";
import { getSessionUserId, destroySession } from "@/lib/auth";
import {
  updateNickname,
  updateAvatar,
  deactivateAccount,
  deleteAccount,
} from "@/server/account/AccountService";

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
