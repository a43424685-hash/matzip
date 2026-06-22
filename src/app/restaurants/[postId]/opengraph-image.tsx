import { ImageResponse } from "next/og";
import { prisma } from "@/lib/db";
import { OG_SIZE, ogFonts, OgFrame } from "@/lib/og";

export const runtime = "nodejs";
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "먹고핀 맛집";

export default async function Image({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  const post = await prisma.restaurantPost
    .findUnique({
      where: { id: postId },
      select: {
        shortReview: true,
        locationVerified: true,
        restaurant: { select: { name: true, primaryRegion: { select: { name: true } } } },
      },
    })
    .catch(() => null);

  const name = post?.restaurant.name ?? "맛집";
  const region = post?.restaurant.primaryRegion.name ?? "";
  const review = post?.shortReview ?? "먹고핀에서 발견한 맛집";
  const badge = [region, post?.locationVerified ? "✓ 인증" : null].filter(Boolean).join(" · ");

  return new ImageResponse(<OgFrame badge={badge || undefined} title={name} subtitle={review} />, {
    ...size,
    fonts: await ogFonts(),
  });
}
