"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Loader2, Smartphone } from "lucide-react";
import { track } from "@/lib/analytics";
import { isNativeApp, purchaseMapProduct } from "@/lib/iapClient";
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

  useEffect(() => {
    setNative(isNativeApp());
  }, []);

  async function buy() {
    if (!buyerId) {
      window.location.href = "/login";
      return;
    }
    if (!agree || busy) return;
    setBusy(true);
    setErr("");
    try {
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

      // 3) 서버 검증 + 구매 확정(잠금 해제)
      const conf = await fetch("/api/payments/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collectionId, transactionId, platform }),
      });
      const cd = await conf.json().catch(() => ({}));
      if (!conf.ok || !cd.ok) {
        setErr(cd.message || "결제 확인에 실패했어요. 결제됐다면 잠시 후 다시 시도해 주세요.");
        setBusy(false);
        return;
      }

      track("purchase", { collection_id: collectionId, value: priceWon ?? undefined });
      router.refresh();
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      // 사용자가 결제창을 닫은 경우 등
      setErr(m && !/cancel/i.test(m) ? m : "결제가 취소됐어요.");
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
    </div>
  );
}
