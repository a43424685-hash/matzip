export default function Loading() {
  return (
    <div>
      <div className="aspect-[4/3] w-full animate-pulse bg-stone-100" />
      <div className="space-y-4 px-5 pt-5">
        <div className="h-7 w-1/2 animate-pulse rounded bg-stone-100" />
        <div className="h-44 w-full animate-pulse rounded-2xl bg-stone-100" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-stone-100" />
        <div className="h-4 w-1/3 animate-pulse rounded bg-stone-100" />
        <div className="h-20 w-full animate-pulse rounded-2xl bg-stone-100" />
      </div>
    </div>
  );
}
