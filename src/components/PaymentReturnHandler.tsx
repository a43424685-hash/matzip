"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { track } from "@/lib/analytics";

/**
 * 포트원 결제 리다이렉트 복귀 처리 (모바일 전체화면 리다이렉트 흐름).
 * redirectUrl로 돌아오면 ?paymentId=...(성공) 또는 ?code=&message=(실패)가 붙어 있다.
 * 성공이면 서버 confirm → 새로고침(잠금 해제), 실패면 안내만.
 *
 * 결제 직후 PG 정산/웹훅 반영에 몇 초 걸릴 수 있어(모바일 리다이렉트 레이스),
 * confirm을 여러 번 재시도한다. 서버 confirm도 PortOne 상태가 PAID로 확정될 때까지
 * 짧게 폴링하므로, 여기 재시도는 웹훅 지연까지 흡수하는 2차 안전장치.
 */
export default function PaymentReturnHandler({ collectionId }: { collectionId: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const paymentId = sp.get("paymentId");
  const code = sp.get("code");
  const done = useRef(false);
  const [state, setState] = useState<"idle" | "confirming" | "error">("idle");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!paymentId || done.current) return;
    done.current = true;

    if (code) {
      // 결제 실패/취소
      setState("error");
      setMsg(sp.get("message") || "결제가 취소됐어요.");
      return;
    }

    let cancelled = false;
    (async () => {
      setState("confirming");
      for (let attempt = 0; attempt < 4 && !cancelled; attempt++) {
        try {
          const conf = await fetch("/api/payments/confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paymentId }),
          });
          const cd = await conf.json().catch(() => ({}));
          if (conf.ok && cd.ok) {
            track("purchase", { collection_id: collectionId });
            router.replace(`/collections/${collectionId}`); // 쿼리 제거
            router.refresh();
            return;
          }
          // 로그인 만료는 재시도해도 소용없음 — 즉시 안내
          if (conf.status === 401) {
            setState("error");
            setMsg("로그인이 만료됐어요. 다시 로그인하면 결제한 지도가 열려요.");
            return;
          }
        } catch {
          /* 네트워크 순간 오류 — 재시도 */
        }
        if (attempt < 3 && !cancelled) await new Promise((r) => setTimeout(r, 1800));
      }
      if (!cancelled) {
        setState("error");
        setMsg("결제 확인이 조금 지연되고 있어요. 결제가 됐다면 잠시 후 새로고침하면 자동으로 열려요.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [paymentId, code, collectionId, router, sp]);

  if (state === "idle") return null;
  if (state === "confirming") {
    return (
      <div className="mx-5 mt-4 flex items-center justify-center gap-2 rounded-xl bg-forest-soft/40 px-4 py-2.5 text-center text-[13px] font-semibold text-forest">
        <Loader2 size={15} className="animate-spin" /> 결제 확인 중…
      </div>
    );
  }
  return (
    <div className="mx-5 mt-4 rounded-xl bg-coral/10 px-4 py-3 text-center text-[13px] font-semibold text-coral-dark">
      {msg}
      <button
        onClick={() => router.refresh()}
        className="mt-2 block w-full rounded-lg bg-coral px-3 py-1.5 text-[13px] font-bold text-white active:scale-95"
      >
        새로고침
      </button>
    </div>
  );
}
