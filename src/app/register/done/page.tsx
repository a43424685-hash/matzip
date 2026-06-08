import Link from "next/link";
import { PartyPopper, MapPin } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function RegisterDonePage({
  searchParams,
}: {
  searchParams: Promise<{ xp?: string; region?: string; postId?: string }>;
}) {
  const sp = await searchParams;
  const xp = Number(sp.xp ?? 0);
  const region = sp.region ?? "";
  const postId = sp.postId;

  return (
    <main className="flex min-h-[80vh] flex-col items-center justify-center px-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-forest-soft text-forest">
        <PartyPopper size={36} />
      </div>
      <h1 className="mt-5 text-2xl font-extrabold text-ink">맛집 등록 완료!</h1>

      <p className="mt-4 text-sm text-ink-muted">현장에서 위치 인증하면</p>
      <div className="mt-1 text-5xl font-black tabular-nums text-coral">
        +{xp.toLocaleString()}
        <span className="ml-1 text-2xl">XP</span>
      </div>
      <p className="mt-2 text-sm text-ink-muted">
        한꺼번에 받아요{region && <> · <b className="text-ink">{region}</b> 지역·전체 레벨 동시 상승</>}
      </p>
      <p className="mt-1 text-[12px] text-stone-400">
        영수증·메뉴판까지 인증하면 XP가 더 커지고, 공유도 인증 후에 열려요.
      </p>

      <div className="mt-10 w-full space-y-2.5">
        {postId && (
          <Link href={`/restaurants/${postId}`} className="btn-primary h-12 w-full !text-base">
            <MapPin size={18} /> 지금 위치 인증하러 가기
          </Link>
        )}
        <div className="flex gap-2.5">
          <Link href="/me" className="btn-ghost h-11 flex-1">
            내 지도
          </Link>
          <Link href="/register" className="btn-ghost h-11 flex-1">
            더 등록하기
          </Link>
        </div>
      </div>
    </main>
  );
}
