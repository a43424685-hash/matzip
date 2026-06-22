"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Check, Search, X, ShieldCheck } from "lucide-react";

type R = {
  restaurantId: string;
  name: string;
  regionName: string;
  source: string;
  verified: boolean;
  inCollection: boolean;
};

/**
 * 리스트에 '내 맛집' 담기 — 풀스크린 피커.
 * 검색 + 지역 필터 + 인증만(유료 지도는 강제) + 선택한 것 위로 + 담긴 개수.
 * 맛집이 100~200개여도 검색/필터로 빠르게 고를 수 있게.
 */
export default function CollectionAddPicker({
  collectionId,
  restaurants,
  paidMap,
}: {
  collectionId: string;
  restaurants: R[];
  paidMap: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(restaurants.map((r) => [r.restaurantId, r.inCollection]))
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(paidMap);

  const addedCount = Object.values(state).filter(Boolean).length;
  const regions = useMemo(
    () => [...new Set(restaurants.map((r) => r.regionName))].sort(),
    [restaurants]
  );

  const filtered = useMemo(() => {
    let list = restaurants;
    if (paidMap || verifiedOnly) list = list.filter((r) => r.verified);
    if (region) list = list.filter((r) => r.regionName === region);
    const k = q.trim().toLowerCase();
    if (k) list = list.filter((r) => r.name.toLowerCase().includes(k));
    // 선택한 것(담긴 것) 위로
    return [...list].sort(
      (a, b) => Number(!!state[b.restaurantId]) - Number(!!state[a.restaurantId])
    );
  }, [restaurants, paidMap, verifiedOnly, region, q, state]);

  async function toggle(rid: string) {
    const next = !state[rid];
    setState((s) => ({ ...s, [rid]: next })); // 낙관적
    setBusy(rid);
    const res = await fetch("/api/collections/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collectionId, restaurantId: rid }),
    });
    setBusy(null);
    if (res.ok) {
      const d = await res.json();
      setState((s) => ({ ...s, [rid]: d.added }));
      router.refresh();
    } else {
      setState((s) => ({ ...s, [rid]: !next })); // 롤백
    }
  }

  if (restaurants.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mt-5 flex w-full items-center justify-between rounded-2xl border border-stone-200 p-4 active:scale-[0.99]"
      >
        <span className="flex items-center gap-1.5 text-sm font-extrabold text-ink">
          <Plus size={16} className="text-forest" /> 내 맛집에서 담기
        </span>
        <span className="text-[13px] font-semibold text-forest">{addedCount}곳 담김 ›</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] mx-auto flex max-w-md flex-col bg-white">
          {/* 헤더 */}
          <div className="flex items-center gap-2 border-b border-stone-100 px-3 py-3">
            <button
              onClick={() => setOpen(false)}
              aria-label="닫기"
              className="flex h-9 w-9 items-center justify-center rounded-full text-ink active:scale-95"
            >
              <X size={22} />
            </button>
            <h3 className="flex-1 text-base font-extrabold text-ink">
              맛집 담기 <span className="text-forest">{addedCount}</span>
            </h3>
            <button onClick={() => setOpen(false)} className="px-2 text-sm font-bold text-forest">
              완료
            </button>
          </div>

          {/* 검색 + 필터 */}
          <div className="space-y-2 border-b border-stone-100 p-3">
            <div className="relative">
              <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="가게 이름 검색"
                className="input h-11 !pl-10"
                autoComplete="off"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="input h-10 flex-1"
              >
                <option value="">지역 전체</option>
                {regions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              {!paidMap && (
                <button
                  onClick={() => setVerifiedOnly((v) => !v)}
                  className={`flex h-10 shrink-0 items-center gap-1 rounded-xl border px-3 text-[13px] font-bold ${
                    verifiedOnly ? "border-forest bg-forest text-white" : "border-stone-200 bg-white text-ink-muted"
                  }`}
                >
                  <ShieldCheck size={15} /> 인증만
                </button>
              )}
            </div>
            {paidMap && (
              <p className="text-[11px] text-stone-400">유료 지도는 인증된 맛집만 담을 수 있어요.</p>
            )}
          </div>

          {/* 목록 */}
          <div className="flex-1 space-y-1.5 overflow-y-auto p-3">
            {filtered.length === 0 ? (
              <p className="py-12 text-center text-sm text-ink-muted">조건에 맞는 맛집이 없어요.</p>
            ) : (
              filtered.map((r) => {
                const on = !!state[r.restaurantId];
                return (
                  <button
                    key={r.restaurantId}
                    onClick={() => toggle(r.restaurantId)}
                    disabled={busy === r.restaurantId}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left ${
                      on ? "border-forest bg-forest-soft" : "border-stone-200 bg-white"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-semibold text-ink">{r.name}</span>
                        {r.verified && (
                          <span className="flex shrink-0 items-center gap-0.5 rounded-md bg-forest px-1 py-0.5 text-[10px] font-bold text-white">
                            <ShieldCheck size={9} /> 인증
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-[12px] text-stone-400">
                        {r.regionName} · {r.source}
                      </span>
                    </span>
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                        on ? "bg-forest text-white" : "bg-stone-100 text-stone-400"
                      }`}
                    >
                      {on ? <Check size={16} /> : <Plus size={16} />}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </>
  );
}
