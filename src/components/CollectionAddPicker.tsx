"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Check, ChevronDown } from "lucide-react";

type R = { restaurantId: string; name: string; regionName: string; source: string; inCollection: boolean };

/**
 * 리스트 안에서 '내가 등록/저장한 맛집'을 골라 담는 피커 (소유자용).
 * 토글은 기존 /api/collections/items(toggleItem) 재사용.
 */
export default function CollectionAddPicker({
  collectionId,
  restaurants,
}: {
  collectionId: string;
  restaurants: R[];
}) {
  const router = useRouter();
  const [state, setState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(restaurants.map((r) => [r.restaurantId, r.inCollection]))
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  if (restaurants.length === 0) return null;
  const addedCount = Object.values(state).filter(Boolean).length;

  async function toggle(rid: string) {
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
    }
  }

  return (
    <section className="mt-5 rounded-2xl border border-stone-200 p-4">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-extrabold text-ink">
          <Plus size={16} className="text-forest" /> 내 맛집에서 담기
          <span className="text-[12px] font-semibold text-stone-400">({addedCount}/{restaurants.length})</span>
        </span>
        <ChevronDown size={18} className={`text-stone-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-3 max-h-80 space-y-1.5 overflow-y-auto">
          {restaurants.map((r) => {
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
                  <span className="block truncate text-sm font-semibold text-ink">{r.name}</span>
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
          })}
        </div>
      )}
    </section>
  );
}
