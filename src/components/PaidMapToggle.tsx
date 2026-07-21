"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Coins, Lock } from "lucide-react";
import { PRICE_TIERS, computeSettlement, SETTLEMENT_NOTICE } from "@/lib/iapTiers";

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
  // 기존 자유가격(레거시)은 가장 가까운 티어로 스냅
  const snapToTier = (won: number | null) => {
    if (won == null) return 2900;
    if (PRICE_TIERS.some((t) => t.won === won)) return won;
    return PRICE_TIERS.reduce(
      (best, t) => (Math.abs(t.won - won) < Math.abs(best - won) ? t.won : best),
      PRICE_TIERS[0].won,
    );
  };
  const [price, setPrice] = useState(snapToTier(initialPrice));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // forSale=true: 실제 판매(공개 리스팅) / false: 비공개 초안 잠금 / isPaid=false: 무료 전환
  async function save(nextPaid: boolean, forSale: boolean) {
    setBusy(true);
    setMsg("");
    const r = await fetch("/api/collections/paid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collectionId, isPaid: nextPaid, priceWon: price, forSale }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok && d.ok) {
      setIsPaid(nextPaid);
      setMsg(
        !nextPaid
          ? "무료로 전환됐어요."
          : forSale
            ? "유료 판매가 시작됐어요."
            : "비공개 초안으로 잠갔어요. (검색·지도에서 숨겨져 자산으로 모여요)"
      );
      router.refresh();
    } else {
      setMsg(d.message || "처리에 실패했어요.");
    }
  }

  // ── 판매 자격 미달: 비공개 초안 잠금만 제공 (자산 쌓기) ──
  if (!canSell) {
    return (
      <section className="mt-5 rounded-2xl border border-stone-200 bg-stone-50 p-4">
        <h2 className="flex items-center gap-1.5 text-sm font-extrabold text-ink">
          <Lock size={16} className="text-forest" /> 비공개 초안으로 모아두기
        </h2>
        <p className="mt-1 text-[13px] text-ink-muted">
          판매는 자격(Lv.20 · 위치 인증 30곳) 달성 후 열려요. 그 전에도{" "}
          <b className="text-ink">비공개로 잠가</b> 두면, 남이 못 베끼게 보관했다가 자격이 되면 그대로 유료로 팔 수 있어요.
        </p>
        <div className="mt-3">
          {isPaid ? (
            <div className="flex items-center gap-2">
              <span className="flex-1 text-[13px] font-semibold text-forest">🔒 비공개 초안으로 잠금됨</span>
              <button
                onClick={() => save(false, false)}
                disabled={busy}
                className="h-11 rounded-xl px-3 text-sm font-semibold text-coral-dark"
              >
                잠금 해제
              </button>
            </div>
          ) : (
            <button
              onClick={() => save(true, false)}
              disabled={busy}
              className="btn-primary h-11 w-full !text-sm"
            >
              비공개 초안으로 잠그기
            </button>
          )}
        </div>
        {msg && <p className="mt-2 text-[12px] text-forest">{msg}</p>}
      </section>
    );
  }

  // ── 판매 자격 보유: 실제 판매 + (옵션) 비공개 초안 ──
  return (
    <section className="mt-5 rounded-2xl border border-forest/25 bg-forest-soft/30 p-4">
      <h2 className="flex items-center gap-1.5 text-sm font-extrabold text-ink">
        <Coins size={16} className="text-forest" /> 유료 지도로 판매
      </h2>
      <p className="mt-1 text-[12px] text-ink-muted">
        구매자는 가게 목록이 가려진 채 지역·개수만 보고, 구매 후 맛보기 외 가게를 하나씩 열어봐요. {SETTLEMENT_NOTICE}
      </p>

      {/* 가격 티어 선택 (5개 고정) */}
      <div className="mt-3 grid grid-cols-5 gap-1.5">
        {PRICE_TIERS.map((t) => (
          <button
            key={t.won}
            onClick={() => setPrice(t.won)}
            className={`rounded-xl border py-2 text-center text-[13px] font-bold tabular-nums transition ${
              price === t.won
                ? "border-forest bg-forest text-white"
                : "border-stone-200 bg-white text-ink active:bg-stone-50"
            }`}
          >
            {(t.won / 1000).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}천
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-[11px] text-stone-400">
        {price.toLocaleString()}원 판매 시 → 내 정산 <b className="text-forest">{computeSettlement(price).sellerNetWon.toLocaleString()}원</b>
      </p>

      <div className="mt-3 flex items-center gap-2">
        {isPaid ? (
          <>
            <button onClick={() => save(true, true)} disabled={busy} className="btn-outline h-11 flex-1 !text-sm">
              가격 변경
            </button>
            <button onClick={() => save(false, true)} disabled={busy} className="h-11 rounded-xl px-3 text-sm font-semibold text-coral-dark">
              판매 중지
            </button>
          </>
        ) : (
          <button onClick={() => save(true, true)} disabled={busy} className="btn-primary h-11 w-full !text-sm">
            판매 시작
          </button>
        )}
      </div>

      {/* 비공개 초안 옵션 — 아직 팔지 않고 자산으로만 잠그고 싶을 때 */}
      {!isPaid && (
        <button
          onClick={() => save(true, false)}
          disabled={busy}
          className="mt-2 text-[13px] font-semibold text-stone-500 underline underline-offset-2"
        >
          아직 팔지 않고 비공개 초안으로만 잠그기
        </button>
      )}

      {isPaid && <p className="mt-1 text-[12px] font-semibold text-forest">현재 유료 판매 중 ({price.toLocaleString()}원)</p>}
      {msg && <p className="mt-1 text-[12px] text-forest">{msg}</p>}
    </section>
  );
}
