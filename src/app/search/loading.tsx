// 검색 탭 진입 시 즉시 보이는 스켈레톤
export default function Loading() {
  return (
    <div className="px-5 py-6">
      <div className="h-7 w-24 animate-pulse rounded-lg bg-stone-100" />
      <div className="mt-4 h-12 w-full animate-pulse rounded-2xl bg-stone-100" />
      <div className="mt-4 flex gap-2 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-9 w-20 shrink-0 animate-pulse rounded-full bg-stone-100" />
        ))}
      </div>
      <div className="mt-6 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-16 w-16 shrink-0 animate-pulse rounded-xl bg-stone-100" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/2 animate-pulse rounded bg-stone-100" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-stone-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
