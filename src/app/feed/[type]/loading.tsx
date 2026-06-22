// 더보기 목록(피드) 진입 시 즉시 보이는 스켈레톤
export default function Loading() {
  return (
    <div className="px-5 py-6">
      <div className="h-7 w-40 animate-pulse rounded-lg bg-stone-100" />
      <div className="mt-5 grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-[150px] w-full animate-pulse rounded-2xl bg-stone-100" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-stone-100" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-stone-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
