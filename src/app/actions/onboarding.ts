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
