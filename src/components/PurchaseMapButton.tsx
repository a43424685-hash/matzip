"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Loader2, Smartphone, RotateCcw } from "lucide-react";
import { track } from "@/lib/analytics";
import { isNativeApp, purchaseMapProduct, restoreMapPurchases } from "@/lib/iapClient";
import { REVEAL_REFUND_THRESHOLD } from "@/lib/iapTiers";

export default function PurchaseMapButton({
  collectionId,
  priceWon,
  buyerId,
}: {
  collectionId: string;
  priceWon: number | null;
  buyerId: string | null;
}) {
  const router = useRouter();
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [native, setNative] = useState(true); // SSR엔 앱 가정 → 마운트 후 실제 판정
  // 결제는 성공했는데 서버 확정이 실패한 경우의 거래ID — 재시도 시 재결제하지 않고 확정만 다시 한다
  const pendingTxRef = useRef<{ transactionId?: string; platform: string } | null>(null);

  useEffect(() => {
    setNative(isNativeApp());
  }, []);

  /** 서버 검증 + 구매 확정(잠금 해제). 성공 시 true. */
  async function confirmOnServer(tx: { transactionId?: string; platform?: string }): Promise<boolean> {
    const conf = await fetch("/api/payments/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collectionId, ...tx }),
    });
    const cd = await conf.json().catch(() => ({}));
    if (!conf.ok || !cd.ok) {
      setErr(cd.message || "결제 확인에 실패했어요. 결제됐다면 아래 '구매 복원'을 눌러주세요.");
      return false;
    }
    pendingTxRef.current = null;
    track("purchase", { collection_id: collectionId, value: priceWon ?? undefined });
    router.refresh();
    return true;
  }

  async function buy() {
    if (!buyerId) {
      window.location.href = `/login?returnTo=${encodeURIComponent(`/collections/${collectionId}`)}`;
      return;
    }
    if (!agree || busy) return;
    setBusy(true);
    setErr("");
    try {
      // 결제됐는데 확정만 실패했던 건이 있으면 재결제 없이 확정부터 재시도
      if (pendingTxRef.current) {
        const done = await confirmOnServer(pendingTxRef.current);
        setBusy(false);
        if (done) return;
        return;
      }

      // 1) 서버에서 결제할 상품ID 발급 (금액·상품은 서버 DB 기준, 구매차단 확인)
      const prep = await fetch("/api/payments/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collectionId }),
      });
      const pd = await prep.json().catch(() => ({}));
      if (!prep.ok || !pd.ok || !pd.productId) {
        setErr(pd.message || "결제를 시작할 수 없어요.");
        setBusy(false);
        return;
      }

      // 2) 네이티브 인앱결제(RevenueCat) — 애플/구글 결제창
      const { transactionId, platform } = await purchaseMapProduct(buyerId, pd.productId);
      pendingTxRef.current = { transactionId, platform };

      // 3) 서버 검증 + 구매 확정(잠금 해제)
      await confirmOnServer({ transactionId, platform });
      setBusy(false);
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      if (/pending|deferred/i.test(m)) {
        // 자녀 보호(승인 대기) 등 — 결제창은 닫혔지만 결제가 진행 중일 수 있음
        setErr("결제 승인 대기 중이에요. 승인이 완료되면 아래 '구매 복원'을 눌러주세요.");
      } else {
        // 사용자가 결제창을 닫은 경우 등
        setErr(m && !/cancel/i.test(m) ? m : "결제가 취소됐어요.");
      }
      setBusy(false);
    }
  }

  /** 이미 결제했는데 잠금이 안 풀린 경우 — 스토어 구매 복원 후 서버 확정 재시도 */
  async function restore() {
    if (!buyerId || busy) return;
    setBusy(true);
    setErr("");
    try {
      await restoreMapPurchases(buyerId);
      await confirmOnServer(pendingTxRef.current ?? {});
    } catch {
      setErr("구매 복원에 실패했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  // 웹 브라우저 — 인앱결제 불가 → 앱으로 안내
  if (!native) {
    return (
      <div className="rounded-xl border border-forest/25 bg-forest-soft/30 p-4 text-center">
        <Smartphone size={22} className="mx-auto text-forest" />
        <p className="mt-1.5 text-sm font-bold text-ink">앱에서 구매할 수 있어요</p>
        <p className="mt-0.5 text-[13px] text-ink-muted">
          유료 지도 구매는 먹고핀 <b>앱(iOS·안드로이드)</b>에서 진행돼요.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* 서비스 제공 기간·환불 규정 안내 (전자상거래법 필수 표시) */}
      <div className="mb-3 rounded-xl bg-stone-50 p-3 text-[12px] leading-relaxed text-stone-500">
        <p>
          <b className="text-ink">서비스 제공</b> · 온라인 디지털 상품으로, 결제 즉시 맛집 지도를 이용할 수 있어요.
        </p>
        <p className="mt-1">
          <b className="text-ink">환불</b> · 콘텐츠 하자·결제 오류는 환불되며, 맛보기 외 <b className="text-ink">{REVEAL_REFUND_THRESHOLD}곳 이상 열람</b> 후에는 단순 변심 환불이 제한됩니다. 반복 환불 시 구매가 제한될 수 있어요.
        </p>
      </div>
      <label className="mb-2 flex items-start gap-2 text-[12px] leading-relaxed text-ink-muted">
        <input
          type="checkbox"
          checked={agree}
          onChange={(e) => setAgree(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-forest"
        />
        <span>
          맛보기 외 {REVEAL_REFUND_THRESHOLD}곳 이상 열람 시 단순 변심 환불이 제한되고, 반복 환불 시 구매가 제한됨에 동의합니다. (콘텐츠 하자·결제 오류는 환불)
        </span>
      </label>
      <button
        onClick={buy}
        disabled={!agree || busy}
        className="btn-primary h-12 w-full !text-base disabled:opacity-50"
      >
        {busy ? (
          <>
            <Loader2 size={17} className="animate-spin" /> 결제 진행 중…
          </>
        ) : (
          <>
            <Lock size={17} /> {priceWon ? `${priceWon.toLocaleString()}원 구매하고 전체 보기` : "구매하고 전체 보기"}
          </>
        )}
      </button>
      {err && <p className="mt-2 text-center text-[13px] text-coral-dark">{err}</p>}
      {buyerId && (
        <button
          type="button"
          onClick={restore}
          disabled={busy}
          className="mx-auto mt-2.5 flex items-center gap-1 text-[12px] font-semibold text-stone-400 underline disabled:opacity-50"
        >
          <RotateCcw size={12} /> 이미 결제했는데 안 열리나요? 구매 복원
        </button>
      )}
    </div>
  );
}
