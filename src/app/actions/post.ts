"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth";
import { createRestaurantPost } from "@/server/restaurant/RestaurantService";
import { XP_AMOUNT } from "@/server/xp/xpRules";

const schema = z.object({
  name: z.string().min(1, "상호명을 입력하세요."),
  primaryRegionId: z.string().min(1, "지역을 선택하세요."),
  categoryIds: z.array(z.string()).min(1, "카테고리를 1개 이상 선택하세요."),
  shortReview: z.string().optional(),
  content: z.string().optional(),
  priceRange: z.string().optional(),
  revisitIntent: z.string().optional(),
  waitingLevel: z.string().optional(),
  address: z.string().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  kakaoPlaceId: z.string().optional(),
  imageUrl: z.string().optional(),
  imageThumbUrl: z.string().optional(),
  videoUrl: z.string().optional(),
  videoThumbUrl: z.string().optional(),
  videoDuration: z.string().optional(),
});

function parseCoord(v?: string): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export type RegisterState = { error?: string } | undefined;

export async function registerPostAction(
  _prev: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const parsed = schema.safeParse({
    name: formData.get("name"),
    primaryRegionId: formData.get("primaryRegionId"),
    categoryIds: formData.getAll("categoryIds").map(String),
    shortReview: formData.get("shortReview") || undefined,
    content: formData.get("content") || undefined,
    priceRange: formData.get("priceRange") || undefined,
    revisitIntent: formData.get("revisitIntent") || undefined,
    waitingLevel: formData.get("waitingLevel") || undefined,
    address: formData.get("address") || undefined,
    latitude: formData.get("latitude") || undefined,
    longitude: formData.get("longitude") || undefined,
    kakaoPlaceId: formData.get("kakaoPlaceId") || undefined,
    imageUrl: formData.get("imageUrl") || undefined,
    imageThumbUrl: formData.get("imageThumbUrl") || undefined,
    videoUrl: formData.get("videoUrl") || undefined,
    videoThumbUrl: formData.get("videoThumbUrl") || undefined,
    videoDuration: formData.get("videoDuration") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.errors[0].message };
  const d = parsed.data;

  const media = [];
  if (d.imageUrl?.trim())
    media.push({
      type: "image" as const,
      url: d.imageUrl.trim(),
      thumbnailUrl: d.imageThumbUrl?.trim() || null,
    });
  if (d.videoUrl?.trim())
    media.push({
      type: "video" as const,
      url: d.videoUrl.trim(),
      thumbnailUrl: d.videoThumbUrl?.trim() || null,
      duration: d.videoDuration ? Number(d.videoDuration) || null : null,
    });

  let result;
  try {
    result = await createRestaurantPost({
      userId,
      name: d.name,
      primaryRegionId: d.primaryRegionId,
      address: d.address ?? null,
      kakaoPlaceId: d.kakaoPlaceId?.trim() || null,
      latitude: parseCoord(d.latitude),
      longitude: parseCoord(d.longitude),
      shortReview: d.shortReview ?? null,
      content: d.content ?? null,
      priceRange: (d.priceRange as never) || null,
      revisitIntent: (d.revisitIntent as never) || null,
      waitingLevel: (d.waitingLevel as never) || null,
      categoryIds: d.categoryIds,
      media,
    });
  } catch (e) {
    return { error: "등록 중 오류가 발생했습니다. 다시 시도해주세요." };
  }

  // 등록 자체는 XP 0. 위치 인증 시 받게 될 "보류 XP"를 미리 보여준다.
  const pendingXp =
    XP_AMOUNT.location_verified +
    XP_AMOUNT.post_created +
    (media.some((m) => m.type === "image") ? XP_AMOUNT.photo_added : 0) +
    (media.some((m) => m.type === "video") ? XP_AMOUNT.video_added : 0) +
    (d.shortReview?.trim() ? XP_AMOUNT.short_review : 0) +
    (d.content?.trim() ? XP_AMOUNT.detail_review : 0) +
    (d.categoryIds.length >= 3 ? XP_AMOUNT.categories : 0) +
    (d.priceRange ? XP_AMOUNT.price : 0) +
    (d.waitingLevel ? XP_AMOUNT.waiting : 0) +
    (d.revisitIntent ? XP_AMOUNT.revisit : 0);

  redirect(
    `/register/done?xp=${pendingXp}&region=${encodeURIComponent(
      result.regionName
    )}&postId=${result.postId}`
  );
}
