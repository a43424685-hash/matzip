"use client";

import { Lock } from "lucide-react";

/**
 * 잠긴 유료 지도 하단 고정 구매 안내 바.
 * 바로 결제하지 않고, 기존 동의·환불 안내 패널(#purchase-panel)로 스크롤 + 포커스만 옮긴다.
 * 실제 구매는 그 패널의 체크박스 동의 후 버튼에서만 일어난다.
 */
export default function StickyPurchaseBar({ priceWon }: { priceWon: number | null }) {
  function goToPanel() {
    const el = document.getElementById("purchase-panel");
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    // 스크롤 후 패널로 포커스 이동 (접근성)
    window.setTimeout(() => el.focus({ preventScroll: true }), 400);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-md items-center gap-3 px-5 py-3">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold text-ink-muted">유료 맛집 지도</div>
          <div className="truncate text-lg font-black text-ink">
            {priceWon ? `${priceWon.toLocaleString()}원` : "가격 확인"}
          </div>
        </div>
        <button
          type="button"
          onClick={goToPanel}
          className="flex h-12 shrink-0 items-center gap-1.5 rounded-xl bg-forest px-5 text-base font-bold text-white active:scale-[0.98]"
        >
          <Lock size={17} /> 구매 조건 확인
        </button>
      </div>
    </div>
  );
}
