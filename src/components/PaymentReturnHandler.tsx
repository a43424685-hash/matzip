"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * 포트원 결제 리다이렉트 복귀 처리 (모바일 전체화면 리다이렉트 흐름).
 * redirectUrl로 돌아오면 ?paymentId=...(성공) 또는 ?code=&message=(실패)가 붙어 있다.
 * 성공이면 서버 confirm → 새로고침(잠금 해제), 실패면 안내만.
 */
export default function PaymentReturnHandler({ collectionId }: { collectionId: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const paymentId = sp.get("paymentId");
  const code = sp.get("code");
  const done = useRef(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!paymentId || done.current) return;
    done.current = true;

    if (code) {
      // 결제 실패/취소
      setMsg(sp.get("message") || "결제가 취소됐어요.");
      return;
    }
    (async () => {
      try {
        const conf = await fetch("/api/payments/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentId }),
        });
        const cd = await conf.json().catch(() => ({}));
        if (conf.ok && cd.ok) {
          router.replace(`/collections/${collectionId}`); // 쿼리 제거
          router.refresh();
        } else {
          setMsg(cd.message || "결제 확인에 실패했어요. 결제됐다면 잠시 후 새로고침해 주세요.");
        }
      } catch {
        setMsg("결제 확인 중 오류가 났어요. 결제됐다면 잠시 후 새로고침해 주세요.");
      }
    })();
  }, [paymentId, code, collectionId, router, sp]);

  if (!msg) return null;
  return (
    <div className="mx-5 mt-4 rounded-xl bg-coral/10 px-4 py-2.5 text-center text-[13px] font-semibold text-coral-dark">
      {msg}
    </div>
  );
}
