"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Loader2 } from "lucide-react";
import * as PortOne from "@portone/browser-sdk/v2";

const STORE_ID = process.env.NEXT_PUBLIC_PORTONE_STORE_ID ?? "";
const CHANNEL_KEY = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_KAKAO ?? "";

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

  async function buy() {
    if (!buyerId) {
      window.location.href = "/login";
      return;
    }
    if (!agree || busy) return;
    setBusy(true);
    setErr("");
    try {
      // 1) 서버에서 주문번호·금액 발급 (금액은 서버 DB 기준)
      const prep = await fetch("/api/payments/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collectionId }),
      });
      const pd = await prep.json().catch(() => ({}));
      if (!prep.ok || !pd.ok) {
        setErr(pd.message || "결제를 시작할 수 없어요.");
        setBusy(false);
        return;
      }

      // 2) 포트원 결제창(카카오페이) 호출
      //   redirectUrl 지정 → 모바일은 전체화면 리다이렉트(작은 QR 모달 오버플로우 방지).
      //   리다이렉트로 돌아오면 PaymentReturnHandler가 confirm 처리. PC는 iframe→아래 promise로 confirm.
      const res = await PortOne.requestPayment({
        storeId: STORE_ID,
        channelKey: CHANNEL_KEY,
        paymentId: pd.paymentId,
        orderName: pd.orderName,
        totalAmount: pd.amount,
        currency: "CURRENCY_KRW",
        payMethod: "EASY_PAY",
        customData: { collectionId, buyerId },
        redirectUrl: `${window.location.origin}/collections/${collectionId}`,
      });
      // 모바일 리다이렉트 흐름이면 여기 도달 전에 페이지가 떠남 → 이후는 PC(iframe) 케이스

      if (!res || res.code != null) {
        // 사용자가 취소했거나 결제 실패
        setErr(res?.message || "결제가 취소됐어요.");
        setBusy(false);
        return;
      }

      // 3) 서버 검증 + 구매 확정
      const conf = await fetch("/api/payments/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: res.paymentId }),
      });
      const cd = await conf.json().catch(() => ({}));
      if (!conf.ok || !cd.ok) {
        setErr(cd.message || "결제 확인에 실패했어요. 결제됐다면 잠시 후 새로고침해 주세요.");
        setBusy(false);
        return;
      }

      // 성공 — 잠금 해제된 화면으로 갱신
      router.refresh();
    } catch (e) {
      console.error(e);
      setErr("결제 중 오류가 났어요. 다시 시도해 주세요.");
      setBusy(false);
    }
  }

  return (
    <div>
      <label className="mb-2 flex items-start gap-2 text-[12px] leading-relaxed text-ink-muted">
        <input
          type="checkbox"
          checked={agree}
          onChange={(e) => setAgree(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-forest"
        />
        <span>
          구매 즉시 맛집 목록 전체가 공개되며, 공개 후에는 환불이 제한됨에 동의합니다. (콘텐츠 하자·결제 오류는 환불)
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
