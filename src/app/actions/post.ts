"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth";
import { createRestaurantPost, updateRestaurantPost } from "@/server/restaurant/RestaurantService";
import { XP_AMOUNT } from "@/server/xp/xpRules";

const schema = z.object({
  name: z.string().min(1, "상호명을 입력하세요."),
  primaryRegionId: z.string().min(1, "지역을 선택하세요."),
  categoryIds: z.array(z.string()).min(1, "카테고리를 1개 이상 선택하세요."),
  shortReview: z.string().optional(),
  content: z.string().optional(),
  tasteRating: z.string().optional(),
  tasteTags: z.array(z.string()).optional(),
  serviceRating: z.string().optional(),
  serviceTags: z.array(z.string()).optional(),
  atmosphereTags: z.array(z.string()).optional(),
  priceRange: z.string().optional(),
  priceMemo: z.string().optional(),
  revisitIntent: z.string().optional(),
  waitingLevel: z.string().optional(),
  address: z.string().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  kakaoPlaceId: z.string().optional(),
  imageUrl: z.string().optional(),
  imageThumbUrl: z.string().optional(),
  imageUrls: z.array(z.string()).optional(),
  imageThumbUrls: z.array(z.string()).optional(),
  videoUrl: z.string().optional(),
  videoThumbUrl: z.string().optional(),
  videoDuration: z.string().optional(),
  videoMuted: z.string().optional(),
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
    tasteRating: formData.get("tasteRating") || undefined,
    tasteTags: formData.getAll("tasteTags").map(String),
    serviceRating: formData.get("serviceRating") || undefined,
    serviceTags: formData.getAll("serviceTags").map(String),
    atmosphereTags: formData.getAll("atmosphereTags").map(String),
    priceRange: formData.get("priceRange") || undefined,
    priceMemo: formData.get("priceMemo") || undefined,
    revisitIntent: formData.get("revisitIntent") || undefined,
    waitingLevel: formData.get("waitingLevel") || undefined,
    address: formData.get("address") || undefined,
    latitude: formData.get("latitude") || undefined,
    longitude: formData.get("longitude") || undefined,
    kakaoPlaceId: formData.get("kakaoPlaceId") || undefined,
    imageUrl: formData.get("imageUrl") || undefined,
    imageThumbUrl: formData.get("imageThumbUrl") || undefined,
    imageUrls: formData.getAll("imageUrls").map(String),
    imageThumbUrls: formData.getAll("imageThumbUrls").map(String),
    videoUrl: formData.get("videoUrl") || undefined,
    videoThumbUrl: formData.get("videoThumbUrl") || undefined,
    videoDuration: formData.get("videoDuration") || undefined,
    videoMuted: formData.get("videoMuted") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.errors[0].message };
  const d = parsed.data;

  const media = [];
  const imageUrls = d.imageUrls?.filter((url) => url.trim()) ?? [];
  const imageThumbUrls = d.imageThumbUrls ?? [];
  if (imageUrls.length > 0) {
    imageUrls.slice(0, 5).forEach((url, index) => {
      media.push({
        type: "image" as const,
        url: url.trim(),
        thumbnailUrl: imageThumbUrls[index]?.trim() || url.trim(),
      });
    });
  } else if (d.imageUrl?.trim()) {
    media.push({
      type: "image" as const,
      url: d.imageUrl.trim(),
      thumbnailUrl: d.imageThumbUrl?.trim() || null,
    });
  }
  if (d.videoUrl?.trim())
    media.push({
      type: "video" as const,
      url: d.videoUrl.trim(),
      thumbnailUrl: d.videoThumbUrl?.trim() || null,
      duration: d.videoDuration ? Number(d.videoDuration) || null : null,
      muted: d.videoMuted === "on",
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
      tasteRating: d.tasteRating ?? null,
      tasteTags: d.tasteTags ?? [],
      serviceRating: d.serviceRating ?? null,
      serviceTags: d.serviceTags ?? [],
      atmosphereTags: d.atmosphereTags ?? [],
      priceRange: (d.priceRange as never) || null,
      priceMemo: d.priceMemo ?? null,
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

// ── 내 글 수정 (가게·지역·좌표는 변경 불가, 내용·사진·카테고리만) ──────────────
const updateSchema = z.object({
  postId: z.string().min(1),
  categoryIds: z.array(z.string()).min(1, "카테고리를 1개 이상 선택하세요."),
  shortReview: z.string().optional(),
  content: z.string().optional(),
  tasteRating: z.string().optional(),
  tasteTags: z.array(z.string()).optional(),
  serviceRating: z.string().optional(),
  serviceTags: z.array(z.string()).optional(),
  atmosphereTags: z.array(z.string()).optional(),
  priceRange: z.string().optional(),
  priceMemo: z.string().optional(),
  revisitIntent: z.string().optional(),
  waitingLevel: z.string().optional(),
  imageUrl: z.string().optional(),
  imageThumbUrl: z.string().optional(),
  imageUrls: z.array(z.string()).optional(),
  imageThumbUrls: z.array(z.string()).optional(),
  videoUrl: z.string().optional(),
  videoThumbUrl: z.string().optional(),
  videoDuration: z.string().optional(),
  videoMuted: z.string().optional(),
});

export async function updatePostAction(
  _prev: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const parsed = updateSchema.safeParse({
    postId: formData.get("postId"),
    categoryIds: formData.getAll("categoryIds").map(String),
    shortReview: formData.get("shortReview") || undefined,
    content: formData.get("content") || undefined,
    tasteRating: formData.get("tasteRating") || undefined,
    tasteTags: formData.getAll("tasteTags").map(String),
    serviceRating: formData.get("serviceRating") || undefined,
    serviceTags: formData.getAll("serviceTags").map(String),
    atmosphereTags: formData.getAll("atmosphereTags").map(String),
    priceRange: formData.get("priceRange") || undefined,
    priceMemo: formData.get("priceMemo") || undefined,
    revisitIntent: formData.get("revisitIntent") || undefined,
    waitingLevel: formData.get("waitingLevel") || undefined,
    imageUrl: formData.get("imageUrl") || undefined,
    imageThumbUrl: formData.get("imageThumbUrl") || undefined,
    imageUrls: formData.getAll("imageUrls").map(String),
    imageThumbUrls: formData.getAll("imageThumbUrls").map(String),
    videoUrl: formData.get("videoUrl") || undefined,
    videoThumbUrl: formData.get("videoThumbUrl") || undefined,
    videoDuration: formData.get("videoDuration") || undefined,
    videoMuted: formData.get("videoMuted") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.errors[0].message };
  const d = parsed.data;

  const media = [];
  const imageUrls = d.imageUrls?.filter((url) => url.trim()) ?? [];
  const imageThumbUrls = d.imageThumbUrls ?? [];
  if (imageUrls.length > 0) {
    imageUrls.slice(0, 5).forEach((url, index) => {
      media.push({ type: "image" as const, url: url.trim(), thumbnailUrl: imageThumbUrls[index]?.trim() || url.trim() });
    });
  } else if (d.imageUrl?.trim()) {
    media.push({ type: "image" as const, url: d.imageUrl.trim(), thumbnailUrl: d.imageThumbUrl?.trim() || null });
  }
  if (d.videoUrl?.trim())
    media.push({
      type: "video" as const,
      url: d.videoUrl.trim(),
      thumbnailUrl: d.videoThumbUrl?.trim() || null,
      duration: d.videoDuration ? Number(d.videoDuration) || null : null,
      muted: d.videoMuted === "on",
    });

  const r = await updateRestaurantPost(userId, d.postId, {
    shortReview: d.shortReview ?? null,
    content: d.content ?? null,
    tasteRating: d.tasteRating ?? null,
    tasteTags: d.tasteTags ?? [],
    serviceRating: d.serviceRating ?? null,
    serviceTags: d.serviceTags ?? [],
    atmosphereTags: d.atmosphereTags ?? [],
    priceRange: (d.priceRange as never) || null,
    priceMemo: d.priceMemo ?? null,
    revisitIntent: (d.revisitIntent as never) || null,
    waitingLevel: (d.waitingLevel as never) || null,
    categoryIds: d.categoryIds,
    media,
  });
  if (!r.ok) return { error: r.reason === "FORBIDDEN" ? "내 글만 수정할 수 있어요." : "수정 중 오류가 발생했어요." };

  redirect(`/restaurants/${d.postId}`);
}
