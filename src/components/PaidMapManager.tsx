"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Coins, ChevronRight, Lock, ExternalLink } from "lucide-react";
import { PRICE_TIERS, computeSettlement } from "@/lib/iapTiers";

type Col = {
  id: string;
  title: string;
  isPaid: boolean;
  isPublic: boolean;
  priceWon: number | null;
  itemCount: number;
  purchaseCount: number;
};

/**
 * 유료 지도 판매 관리 허브 — 내 리스트를 여기서 바로 켜고/끄고/가격 조정.
 * 판매 시작 시 서버가 맛보기 지정·인증 여부를 검증하므로, 추가 설정이 필요하면
 * 해당 리스트 상세로 바로 보낸다(한 흐름으로 정리).
 */
export default function PaidMapManager({ collections }: { collections: Col[] }) {
  if (collections.length === 0) {
    return (
      <div className="mt-5 rounded-2xl bg-stone-50 p-6 text-center">
        <p className="text-sm font-bold text-ink">판매할 리스트가 아직 없어요.</p>
        <p className="mt-1 text-[13px] text-ink-muted">
          먼저 맛집 리스트를 만들고 맛집을 담아보세요.
        </p>
        <Link
          href="/me/collections"
          className="mt-3 inline-flex h-10 items-center gap-1 rounded-xl border border-forest/30 bg-forest-soft/30 px-4 text-sm font-bold text-forest active:scale-95"
        >
          내 리스트 보기 <ChevronRight size={15} />
        </Link>
      </div>
    );
  }
  return (
    <section className="mt-5 space-y-2.5">
      <h2 className="flex items-center gap-1.5 text-sm font-extrabold text-ink">
        <Coins size={15} className="text-forest" /> 내 리스트 판매 관리 {collections.length}개
      </h2>
      {collections.map((c) => (
        <Row key={c.id} col={c} />
      ))}
    </section>
  );
}

function Row({ col }: { col: Col }) {
  const router = useRouter();
  const selling = col.isPaid && col.isPublic;
  const draft = col.isPaid && !col.isPublic;
  const snapToTier = (won: number | null) => {
    if (won == null) return 2900;
    if (PRICE_TIERS.some((t) => t.won === won)) return won;
    return PRICE_TIERS.reduce(
      (best, t) => (Math.abs(t.won - won) < Math.abs(best - won) ? t.won : best),
      PRICE_TIERS[0].won,
    );
  };
  const [price, setPrice] = useState(snapToTier(col.priceWon));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [needDetail, setNeedDetail] = useState(false);

  async function save(nextPaid: boolean, forSale: boolean) {
    setBusy(true);
    setMsg("");
    setNeedDetail(false);
    const r = await fetch("/api/collections/paid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collectionId: col.id, isPaid: nextPaid, priceWon: price, forSale }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok && d.ok) {
      router.refresh();
      setMsg(nextPaid ? (forSale ? "판매를 시작했어요." : "비공개 초안으로 잠갔어요.") : "판매를 중지했어요.");
    } else {
      setMsg(d.message || "처리에 실패했어요.");
      // 맛보기 지정·인증 필요 → 상세에서 마무리하도록 안내
      if (d.reason === "NEED_PREVIEW" || d.reason === "NEED_VERIFIED") setNeedDetail(true);
    }
  }

  return (
    <div className="card p-3.5">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-bold text-ink">{col.title}</span>
            {selling && (
              <span className="shrink-0 rounded-md bg-forest px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                판매중
              </span>
            )}
            {draft && (
              <span className="flex shrink-0 items-center gap-0.5 rounded-md bg-stone-200 px-1.5 py-0.5 text-[10px] font-bold text-stone-600">
                <Lock size={9} /> 초안
              </span>
            )}
          </div>
          <div className="mt-0.5 text-[12px] text-ink-muted">
            맛집 {col.itemCount}곳 · 구매 {col.purchaseCount}건
          </div>
        </div>
        <Link
          href={`/collections/${col.id}`}
          className="flex h-8 shrink-0 items-center gap-0.5 rounded-lg px-2 text-[12px] font-semibold text-stone-500 active:scale-95"
        >
          상세 <ChevronRight size={14} />
        </Link>
      </div>

      {/* 가격 티어 선택 (5개 고정) */}
      <div className="mt-2.5 grid grid-cols-5 gap-1.5">
        {PRICE_TIERS.map((t) => (
          <button
            key={t.won}
            onClick={() => setPrice(t.won)}
            disabled={busy}
            className={`rounded-lg border py-1.5 text-center text-[12px] font-bold tabular-nums transition ${
              price === t.won
                ? "border-forest bg-forest text-white"
                : "border-stone-200 bg-white text-ink active:bg-stone-50"
            }`}
          >
            {(t.won / 1000).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}천
          </button>
        ))}
      </div>
      <p className="mt-1 text-[11px] text-stone-400">
        정산 <b className="text-forest">{computeSettlement(price).sellerNetWon.toLocaleString()}원</b> (수수료 차감 후)
      </p>

      <div className="mt-2 flex items-center gap-2">
        {selling ? (
          <>
            <button onClick={() => save(true, true)} disabled={busy} className="btn-outline h-10 flex-1 !text-[13px]">
              가격변경
            </button>
            <button
              onClick={() => save(false, true)}
              disabled={busy}
              className="h-10 rounded-xl px-3 text-[13px] font-semibold text-coral-dark"
            >
              판매중지
            </button>
          </>
        ) : (
          <button onClick={() => save(true, true)} disabled={busy} className="btn-primary h-10 w-full !text-[13px]">
            판매 시작
          </button>
        )}
      </div>

      {msg && (
        <p className={`mt-1.5 text-[12px] font-semibold ${needDetail ? "text-coral-dark" : "text-forest"}`}>
          {msg}
        </p>
      )}
      {needDetail && (
        <Link
          href={`/collections/${col.id}`}
          className="mt-1 inline-flex items-center gap-0.5 text-[12px] font-bold text-forest underline underline-offset-2"
        >
          <ExternalLink size={12} /> 상세에서 맛보기 지정하고 판매 시작하기
        </Link>
      )}
    </div>
  );
}
