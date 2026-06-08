"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth";
import { createCollection } from "@/server/collection/CollectionService";

const schema = z.object({
  title: z.string().min(1, "리스트 제목을 입력하세요.").max(40),
  description: z.string().max(200).optional(),
  regionId: z.string().min(1, "대표 지역을 선택하세요."),
  isPublic: z.boolean(),
});

export type CollectionState = { error?: string } | undefined;

export async function createCollectionAction(
  _prev: CollectionState,
  formData: FormData
): Promise<CollectionState> {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const parsed = schema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    regionId: formData.get("regionId") || undefined,
    isPublic: formData.get("isPublic") !== "false",
  });
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const col = await createCollection({
    userId,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    regionId: parsed.data.regionId,
    isPublic: parsed.data.isPublic,
  });
  redirect(`/collections/${col.id}`);
}
