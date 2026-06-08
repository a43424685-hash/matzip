import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import ShareExport from "@/components/share/ShareExport";
import ShareCard from "@/components/share/ShareCard";

export const dynamic = "force-dynamic";

export default async function SharePage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  const [user, post] = await Promise.all([
    getCurrentUser(),
    prisma.restaurantPost.findUnique({
      where: { id: postId },
      select: {
        id: true,
        locationVerified: true,
        shortReview: true,
        restaurant: { select: { name: true, primaryRegion: { select: { name: true } } } },
        user: { select: { nickname: true, totalLevel: true } },
        categories: { select: { category: { select: { name: true } } } },
      },
    }),
  ]);

  if (!post) notFound();

  // 위치 인증(방문 인증)된 글만 공유 가능
  if (!post.locationVerified) {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <MapPin size={36} className="text-stone-300" strokeWidth={1.6} />
        <h1 className="text-lg font-extrabold text-ink">아직 공유할 수 없어요</h1>
        <p className="text-sm text-ink-muted">
          이 맛집은 <b>위치 인증(방문 인증)</b>이 완료된 뒤에 공유할 수 있어요.
          <br />
          현장에서 위치 인증을 먼저 해주세요.
        </p>
        <Link href={`/restaurants/${post.id}`} className="btn-primary mt-2 h-11 px-5 !text-sm">
          맛집으로 돌아가기
        </Link>
      </main>
    );
  }

  // "내 Lv" — 공유하는 본인 기준 (로그인 시), 없으면 등록자
  const nickname = user?.nickname ?? post.user.nickname;
  const level = user?.totalLevel ?? post.user.totalLevel;

  const data = {
    restaurantName: post.restaurant.name,
    regionName: post.restaurant.primaryRegion.name,
    shortReview: post.shortReview,
    categories: post.categories.map((c) => c.category.name),
    nickname,
    level,
  };

  return (
    <ShareExport
      pageTitle="맛집 공유 카드"
      pageSubtitle="인스타·카톡에 “내가 이런 맛집 알아”를 공유해보세요."
      filename={`먹고핀-${data.restaurantName}.png`}
      shareTitle={data.restaurantName}
      shareText={`${data.restaurantName} (${data.regionName}) — 먹고핀에서 발견`}
      cardWidth={400}
      cardHeight={500}
    >
      <ShareCard data={data} />
    </ShareExport>
  );
}
