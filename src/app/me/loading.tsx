// 내정보 탭 진입 시 즉시 보이는 스켈레톤
export default function Loading() {
  return (
    <div>
      <div className="bg-forest px-5 pb-8 pt-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 shrink-0 animate-pulse rounded-full bg-white/20" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-1/3 animate-pulse rounded bg-white/20" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-white/15" />
          </div>
        </div>
        <div className="mt-4 h-2.5 w-full animate-pulse rounded-full bg-white/15" />
      </div>
      <div className="space-y-2.5 px-5 py-6">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-12 w-full animate-pulse rounded-2xl bg-stone-100" />
        ))}
      </div>
    </div>
  );
}
