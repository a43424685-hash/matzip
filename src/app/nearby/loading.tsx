// 주변 탭 진입 시 즉시 보이는 스켈레톤 (지도 + 목록)
export default function Loading() {
  return (
    <div className="px-5 py-6">
      <div className="h-7 w-28 animate-pulse rounded-lg bg-stone-100" />
      <div className="mt-4 h-[260px] w-full animate-pulse rounded-2xl bg-stone-100" />
      <div className="mt-5 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-16 w-16 shrink-0 animate-pulse rounded-xl bg-stone-100" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/3 animate-pulse rounded bg-stone-100" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-stone-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
