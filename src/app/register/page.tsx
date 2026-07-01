import Link from "next/link";
import { X } from "lucide-react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveRegions, getActiveCategories, groupCategoriesByType } from "@/server/catalog";
import RegisterForm from "@/components/RegisterForm";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const sp = await searchParams;

  const [regions, categories] = await Promise.all([
    getActiveRegions(),
    getActiveCategories(),
  ]);
  const groups = groupCategoriesByType(categories);

  // 운영자 PICK 등 기존 가게에서 "내 맛집으로 등록" 진입 → 장소 프리필
  let prefillPlace = null;
  if (sp.add) {
    const r = await prisma.restaurant.findUnique({
      where: { id: sp.add },
      select: {
        name: true,
        address: true,
        latitude: true,
        longitude: true,
        kakaoPlaceId: true,
        primaryRegion: { select: { name: true } },
      },
    });
    if (r && r.latitude != null && r.longitude != null) {
      prefillPlace = {
        name: r.name,
        address: r.address ?? "",
        latitude: r.latitude,
        longitude: r.longitude,
        regionName: r.primaryRegion?.name ?? null,
        kakaoPlaceId: r.kakaoPlaceId ?? null,
      };
    }
  }

  return (
    <main className="px-5 py-6">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-ink">{prefillPlace ? "내 맛집으로 등록" : "맛집 등록"}</h1>
        <Link
          href="/"
          aria-label="닫기"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-ink active:scale-95"
        >
          <X size={20} strokeWidth={2.4} />
        </Link>
      </div>
      <p className="mb-6 text-sm text-ink-muted">
        {prefillPlace ? (
          <>
            <b className="text-ink">{prefillPlace.name}</b>를 내 맛집으로 등록해요. 한줄평·사진을 더하면 XP가 쌓여요.
          </>
        ) : (
          <>
            필수는 <b className="text-ink">상호명 · 지역 · 카테고리</b>. 더 채울수록 XP가 쌓여요.
          </>
        )}
      </p>
      <RegisterForm regions={regions} categoryGroups={groups} prefillPlace={prefillPlace} />
    </main>
  );
}
