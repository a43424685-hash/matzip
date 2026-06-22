// 랭킹 탭 진입 시 즉시 보이는 스켈레톤
export default function Loading() {
  return (
    <div className="px-5 py-6">
      <div className="h-7 w-24 animate-pulse rounded-lg bg-stone-100" />
      <div className="mt-4 h-20 w-full animate-pulse rounded-2xl bg-stone-100" />
      <div className="mt-5 space-y-2.5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-2xl border border-stone-100 p-3">
            <div className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-stone-100" />
            <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-stone-100" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 animate-pulse rounded bg-stone-100" />
              <div className="h-3 w-1/4 animate-pulse rounded bg-stone-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
