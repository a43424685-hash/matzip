// 맛집 지도(컬렉션) 진입 시 즉시 보이는 스켈레톤
export default function Loading() {
  return (
    <div>
      <div className="bg-forest px-5 pb-6 pt-6">
        <div className="h-3 w-24 animate-pulse rounded bg-white/15" />
        <div className="mt-2 h-7 w-1/2 animate-pulse rounded-lg bg-white/20" />
        <div className="mt-3 h-4 w-1/3 animate-pulse rounded bg-white/15" />
      </div>
      <div className="px-5 pt-4">
        <div className="h-12 w-full animate-pulse rounded-2xl bg-stone-100" />
        <div className="mt-4 h-16 w-full animate-pulse rounded-2xl bg-stone-100" />
        <div className="mt-3 h-[320px] w-full animate-pulse rounded-2xl bg-stone-100" />
        <div className="mt-3 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-14 w-14 shrink-0 animate-pulse rounded-xl bg-stone-100" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/2 animate-pulse rounded bg-stone-100" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-stone-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
