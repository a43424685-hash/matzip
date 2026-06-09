"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Coins } from "lucide-react";

export default function PaidMapToggle({
  collectionId,
  initialIsPaid,
  initialPrice,
  canSell,
}: {
  collectionId: string;
  initialIsPaid: boolean;
  initialPrice: number | null;
  canSell: boolean;
}) {
  const router = useRouter();
  const [isPaid, setIsPaid] = useState(initialIsPaid);
  const [price, setPrice] = useState(initialPrice ?? 2900);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function save(nextPaid: boolean) {
    setBusy(true);
    setMsg("");
    const r = await fetch("/api/collections/paid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collectionId, isPaid: nextPaid, priceWon: price }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok && d.ok) {
      setIsPaid(nextPaid);
      setMsg(nextPaid ? "유료 지도로 전환됐어요." : "무료로 전환됐어요.");
      router.refresh();
    } else {
      setMsg(d.message || "처리에 실패했어요.");
    }
  }

  if (!canSell && !initialIsPaid) {
    return (
      <section className="mt-5 rounded-2xl border border-stone-200 bg-stone-50 p-4">
        <h2 className="flex items-center gap-1.5 text-sm font-extrabold text-ink">
          <Coins size={16} className="text-forest" /> 유료 지도로 판매
        </h2>
        <p className="mt-1 text-[13px] text-ink-muted">
          판매 자격(Lv.50 · 위치 인증 100곳) 달성 후 이 리스트를 유료로 팔 수 있어요.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-5 rounded-2xl border border-forest/25 bg-forest-soft/30 p-4">
      <h2 className="flex items-center gap-1.5 text-sm font-extrabold text-ink">
        <Coins size={16} className="text-forest" /> 유료 지도로 판매
      </h2>
      <p className="mt-1 text-[12px] text-ink-muted">
        구매자는 가게 목록이 가려진 채 지역·개수만 보고, 구매하면 전체가 열려요. 수수료 30% 차감 후 정산돼요.
      </p>

      <div className="mt-3 flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="number"
            min={990}
            max={9900}
            step={100}
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            className="input h-11 !pr-8"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-stone-400">원</span>
        </div>
        {isPaid ? (
          <>
            <button onClick={() => save(true)} disabled={busy} className="btn-outline h-11 px-3 !text-sm">
              가격 변경
            </button>
            <button onClick={() => save(false)} disabled={busy} className="h-11 rounded-xl px-3 text-sm font-semibold text-coral-dark">
              판매 중지
            </button>
          </>
        ) : (
          <button onClick={() => save(true)} disabled={busy} className="btn-primary h-11 px-4 !text-sm">
            판매 시작
          </button>
        )}
      </div>
      <p className="mt-1 text-[11px] text-stone-400">990~9,900원 사이로 정할 수 있어요.</p>
      {isPaid && <p className="mt-1 text-[12px] font-semibold text-forest">현재 유료 판매 중 ({price.toLocaleString()}원)</p>}
      {msg && <p className="mt-1 text-[12px] text-forest">{msg}</p>}
    </section>
  );
}
