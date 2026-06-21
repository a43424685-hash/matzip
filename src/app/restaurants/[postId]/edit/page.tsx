import { notFound, redirect } from "next/navigation";
import { X } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveRegions, getActiveCategories, groupCategoriesByType } from "@/server/catalog";
import RegisterForm, { type InitialPost } from "@/components/RegisterForm";
import ReplaceLink from "@/components/ReplaceLink";

export const dynamic = "force-dynamic";

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const post = await prisma.restaurantPost.findUnique({
    where: { id: postId },
    select: {
      id: true,
      userId: true,
      shortReview: true,
      content: true,
      priceRange: true,
      priceMemo: true,
      tasteRating: true,
      tasteTags: true,
      serviceRating: true,
      serviceTags: true,
      atmosphereTags: true,
      revisitIntent: true,
      waitingLevel: true,
      restaurant: { select: { name: true, address: true, primaryRegionId: true } },
      media: {
        orderBy: { sortOrder: "asc" },
        select: { type: true, url: true, thumbnailUrl: true, duration: true },
      },
      categories: { select: { categoryId: true } },
    },
  });
  if (!post) notFound();
  if (post.userId !== user.id) redirect(`/restaurants/${postId}`); // 본인 글만 수정

  const [regions, categories] = await Promise.all([getActiveRegions(), getActiveCategories()]);
  const groups = groupCategoriesByType(categories);

  const images = post.media
    .filter((m) => m.type === "image")
    .map((m) => ({ url: m.url, thumbnailUrl: m.thumbnailUrl ?? m.url }));
  const video = post.media.find((m) => m.type === "video");

  const initial: InitialPost = {
    postId: post.id,
    name: post.restaurant.name,
    regionId: post.restaurant.primaryRegionId,
    address: post.restaurant.address ?? "",
    shortReview: post.shortReview ?? "",
    content: post.content ?? "",
    priceRange: post.priceRange ?? "",
    priceMemo: post.priceMemo ?? "",
    tasteRating: post.tasteRating ?? "",
    tasteTags: post.tasteTags ?? [],
    serviceRating: post.serviceRating ?? "",
    serviceTags: post.serviceTags ?? [],
    atmosphereTags: post.atmosphereTags ?? [],
    revisitIntent: post.revisitIntent ?? "",
    waitingLevel: post.waitingLevel ?? "",
    categoryIds: post.categories.map((c) => c.categoryId),
    images,
    videoUrl: video?.url ?? "",
    videoThumb: video?.thumbnailUrl ?? "",
    videoDuration: video?.duration != null ? String(video.duration) : "",
  };

  return (
    <main className="px-5 py-6">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-ink">맛집 수정</h1>
        <ReplaceLink
          href="/"
          ariaLabel="닫기"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-ink active:scale-95"
        >
          <X size={20} strokeWidth={2.4} />
        </ReplaceLink>
      </div>
      <p className="mb-6 text-sm text-ink-muted">
        내용·사진·카테고리를 고칠 수 있어요. <b className="text-ink">사진은 ◀ ▶로 순서를 바꿀 수 있어요.</b>
      </p>
      <RegisterForm regions={regions} categoryGroups={groups} mode="edit" initial={initial} />
    </main>
  );
}
