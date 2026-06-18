"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

const SORTS = [
  { key: "popular", label: "인기순" },
  { key: "recent", label: "최신순" },
  { key: "name", label: "가나다순" },
];

export default function FeedControls({
  regions,
  sort,
  regionId,
}: {
  regions: { id: string; name: string }[];
  sort: string;
  regionId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function setParam(key: string, val: string) {
    const p = new URLSearchParams(sp.toString());
    if (val) p.set(key, val);
    else p.delete(key);
    router.push(`${pathname}?${p.toString()}`);
    // 쿼리만 바뀌면 ScrollReset(pathname 의존)이 안 타므로 직접 맨 위로
    window.scrollTo(0, 0);
  }

  return (
    <div className="flex items-center justify-between gap-2 py-3">
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
        {SORTS.map((s) => (
          <button
            key={s.key}
            onClick={() => setParam("sort", s.key)}
            className={`h-9 shrink-0 rounded-full px-3.5 text-[13px] font-bold ${
              sort === s.key ? "bg-forest text-white" : "bg-stone-100 text-ink-muted"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <select
        value={regionId ?? ""}
        onChange={(e) => setParam("regionId", e.target.value)}
        className="h-9 shrink-0 rounded-full border border-stone-200 bg-white px-3 text-[13px] font-semibold text-ink"
      >
        <option value="">전체 지역</option>
        {regions.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
    </div>
  );
}
