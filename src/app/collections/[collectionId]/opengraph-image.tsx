import { ImageResponse } from "next/og";
import { prisma } from "@/lib/db";
import { OG_SIZE, ogFonts, OgFrame } from "@/lib/og";

export const runtime = "nodejs";
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "먹고핀 맛집 지도";

export default async function Image({ params }: { params: Promise<{ collectionId: string }> }) {
  const { collectionId } = await params;
  const col = await prisma.collection
    .findUnique({
      where: { id: collectionId },
      select: {
        title: true,
        isPaid: true,
        region: { select: { name: true } },
        user: { select: { nickname: true } },
        _count: { select: { items: true } },
      },
    })
    .catch(() => null);

  const title = col?.title ?? "맛집 지도";
  const badge = [col?.region.name, col?.isPaid ? "유료 지도" : null, `맛집 ${col?._count.items ?? 0}곳`]
    .filter(Boolean)
    .join(" · ");
  const subtitle = col ? `${col.user.nickname}님이 모은 맛집` : "먹고핀 맛집 지도";

  return new ImageResponse(<OgFrame badge={badge} title={title} subtitle={subtitle} />, {
    ...size,
    fonts: await ogFonts(),
  });
}
