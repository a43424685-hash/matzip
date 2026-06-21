"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";

type Item = { restaurantId: string; restaurantName: string; isPreview: boolean };

/**
 * 유료 지도 '맛보기' 선택 — 소유자가 구매 전 무료 공개할 가게를 고른다.
 * need(기본 5)곳 이상 골라야 유료 오픈 가능.
 */
export default function PreviewPicker({
  collectionId,
  items,
  need,
}: {
  collectionId: string;
  items: Item[];
  need: number;
}) {
  const router = useRouter();
  const [state, setState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.map((i) => [i.restaurantId, i.isPreview]))
  );
  const [busy, setBusy] = useState(false);
  const count = Object.values(state).filter(Boolean).length;
  const done = count === need;

  async function toggle(rid: string) {
    const next = !state[rid];
    // 최대 need(5)곳까지만 — 이미 5곳이면 추가 선택 막음
    if (next && count >= need) return;
    setState((s) => ({ ...s, [rid]: next }));
    setBusy(true);
    const r = await fetch("/api/collections/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collectionId, restaurantId: rid, isPreview: next }),
    });
    setBusy(false);
    if (r.ok) router.refresh();
    else setState((s) => ({ ...s, [rid]: !next })); // 실패 시 롤백
  }

  return (
    <section className="mt-5 rounded-2xl border border-stone-200 p-4">
      <h2 className="flex items-center gap-1.5 text-sm font-extrabold text-ink">
        <Eye size={16} className="text-forest" /> 맛보기 무료 공개
        <span className={`ml-1 text-[13px] font-bold ${done ? "text-forest" : "text-coral-dark"}`}>
          {count}/{need}
        </span>
      </h2>
      <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">
        구매 전 손님에게 보여줄 가게를 <b className="text-ink">정확히 {need}곳</b> 골라주세요(최대 {need}곳). 나머지는 구매 후 공개돼요.
        {!done && <span className="font-semibold text-coral-dark"> (지금 {need - count}곳 더 필요)</span>}
        {done && <span className="font-semibold text-forest"> (다 골랐어요)</span>}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((i) => {
          const on = !!state[i.restaurantId];
          const disabled = busy || (!on && count >= need); // 5곳 다 차면 추가 비활성
          return (
            <button
              key={i.restaurantId}
              onClick={() => toggle(i.restaurantId)}
              disabled={disabled}
              className={`max-w-full truncate rounded-full border px-3 py-1.5 text-[13px] font-semibold transition active:scale-95 ${
                on ? "border-forest bg-forest text-white" : "border-stone-200 bg-white text-ink-muted"
              } ${disabled && !on ? "opacity-40" : ""}`}
            >
              {on ? "✓ " : ""}
              {i.restaurantName}
            </button>
          );
        })}
      </div>
    </section>
  );
}
