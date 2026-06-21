import { Check, MapPin, Lock, ChevronLeft } from "lucide-react";
import ReplaceLink from "@/components/ReplaceLink";

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
    <main className="relative flex min-h-[80vh] flex-col items-center justify-center px-6 text-center">
      <ReplaceLink
        href="/"
        ariaLabel="홈으로"
        className="absolute left-3 top-3 flex h-10 w-10 items-center justify-center rounded-full text-ink active:scale-95"
      >
        <ChevronLeft size={26} strokeWidth={2.4} />
      </ReplaceLink>

      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-forest-soft text-forest">
        <Check size={40} strokeWidth={3} />
      </div>
      <h1 className="mt-5 text-2xl font-extrabold text-ink">맛집 등록 완료!</h1>

      {/* 핵심: 등록만으론 경험치 0, 인증해야 들어옴 */}
      <div className="mt-5 w-full rounded-2xl border border-coral/25 bg-coral/5 p-5">
        <p className="flex items-center justify-center gap-1.5 text-sm font-bold text-coral-dark">
          <Lock size={16} /> 아직 경험치는 0이에요
        </p>
        <div className="mt-2 text-4xl font-black tabular-nums text-stone-300">
          +{xp.toLocaleString()}
          <span className="ml-1 text-xl">XP</span>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
          <b className="text-ink">현장에서 위치 인증</b>해야 위 경험치가 한꺼번에 들어와요.
          {region && <> 인증하면 <b className="text-ink">{region}</b> 지역·전체 레벨이 같이 올라요.</>}
          <br />
          등록만으론 경험치가 쌓이지 않아요.
        </p>
      </div>

      <div className="mt-8 w-full space-y-2.5">
        {postId && (
          <ReplaceLink href={`/restaurants/${postId}`} className="btn-primary h-12 w-full !text-base">
            <MapPin size={18} /> 지금 위치 인증하러 가기
          </ReplaceLink>
        )}
        <div className="flex gap-2.5">
          <ReplaceLink href="/me" className="btn-ghost h-11 flex-1">
            내 지도
          </ReplaceLink>
          <ReplaceLink href="/register" className="btn-ghost h-11 flex-1">
            더 등록하기
          </ReplaceLink>
        </div>
      </div>
    </main>
  );
}
