// 네비게이션 즉시 표시되는 스켈레톤 (서버 렌더 동안 화면이 바로 반응 → 빠르게 느껴짐)
export default function Loading() {
  return (
    <div className="px-5 py-6">
      <div className="h-7 w-28 animate-pulse rounded-lg bg-stone-100" />
      <div className="mt-4 h-12 w-full animate-pulse rounded-2xl bg-stone-100" />
      <div className="mt-7 h-5 w-40 animate-pulse rounded bg-stone-100" />
      <div className="mt-3 flex gap-3 overflow-hidden">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-[210px] w-[184px] shrink-0 animate-pulse rounded-2xl bg-stone-100" />
        ))}
      </div>
      <div className="mt-7 h-5 w-40 animate-pulse rounded bg-stone-100" />
      <div className="mt-3 flex gap-3 overflow-hidden">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-[210px] w-[184px] shrink-0 animate-pulse rounded-2xl bg-stone-100" />
        ))}
      </div>
    </div>
  );
}
