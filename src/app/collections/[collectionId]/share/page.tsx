import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCollectionDetail } from "@/server/collection/CollectionService";
import ShareExport from "@/components/share/ShareExport";
import CollectionShareCard from "@/components/share/CollectionShareCard";

export const dynamic = "force-dynamic";

export default async function CollectionSharePage({
  params,
}: {
  params: Promise<{ collectionId: string }>;
}) {
  const { collectionId } = await params;
  const [user, col] = await Promise.all([
    getCurrentUser(),
    getCollectionDetail(collectionId),
  ]);
  if (!col) notFound();
  if (!col.isPublic && user?.id !== col.ownerId) notFound();

  const data = {
    title: col.title,
    regionName: col.regionName,
    itemCount: col.itemCount,
    topRestaurants: col.items.slice(0, 5).map((i) => ({
      name: i.restaurantName,
      regionName: i.regionName,
    })),
    nickname: col.ownerNickname,
    level: col.ownerLevel,
  };

  return (
    <ShareExport
      pageTitle="리스트 공유 카드"
      pageSubtitle="내가 모은 맛집 리스트를 인스타·카톡에 자랑해보세요."
      filename={`먹고핀-${data.title}.png`}
      shareTitle={data.title}
      shareText={`${data.title} (맛집 ${data.itemCount}곳) — 먹고핀`}
      cardWidth={400}
      cardHeight={600}
    >
      <CollectionShareCard data={data} />
    </ShareExport>
  );
}
