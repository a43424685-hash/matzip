// ─────────────────────────────────────────────────────────────
// 인앱결제(IAP) 가격 티어 · 정산 · 환불 정책 — 단일 진실 공급원
// UI(셀러 티어선택·구매)와 서버(검증·정산·환불)가 모두 이 파일을 참조한다.
// 애플 App Store Connect / 구글 Play Console 에 등록한 상품 ID와 반드시 일치.
// ─────────────────────────────────────────────────────────────

export interface PriceTier {
  won: number; // 판매가(원)
  productId: string; // 스토어 상품 ID (애플·구글 동일)
  label: string; // 셀러 선택 UI 표시
}

/** 유료 지도 가격 티어 (고정) — 셀러는 이 중에서만 선택. IAP는 고정가 상품만 되므로. */
export const PRICE_TIERS: PriceTier[] = [
  { won: 2900, productId: "map_unlock_2900", label: "2,900원 · 동네 입문" },
  { won: 4900, productId: "map_unlock_4900", label: "4,900원 · 알짜" },
  { won: 9900, productId: "map_unlock_9900", label: "9,900원 · 프리미엄" },
  { won: 14900, productId: "map_unlock_14900", label: "14,900원 · 고인물" },
  { won: 19900, productId: "map_unlock_19900", label: "19,900원 · 시크릿" },
];

export const TIER_WONS = PRICE_TIERS.map((t) => t.won);
export const ALL_PRODUCT_IDS = PRICE_TIERS.map((t) => t.productId);

/** 판매가(원)가 유효한 티어인지 */
export function isValidTierWon(won: number | null | undefined): boolean {
  return typeof won === "number" && TIER_WONS.includes(won);
}

/** 판매가(원) → 스토어 상품 ID */
export function productIdForWon(won: number): string | null {
  return PRICE_TIERS.find((t) => t.won === won)?.productId ?? null;
}

/** 스토어 상품 ID → 판매가(원) */
export function wonForProductId(productId: string): number | null {
  return PRICE_TIERS.find((t) => t.productId === productId)?.won ?? null;
}

// ── 정산 (2026-07 확정) ──────────────────────────────────────
// 애플·구글이 먼저 STORE_FEE_RATE 를 뗀 뒤, 남은 금액을 셀러/플랫폼이 나눈다.
export const STORE_FEE_RATE = 0.15; // 애플·구글 소상공인 수수료 15%
export const SELLER_SHARE = 0.8; // 스토어 수수료 뗀 후 셀러 몫
export const PLATFORM_SHARE = 0.2; // 스토어 수수료 뗀 후 플랫폼 몫

export interface Settlement {
  amountWon: number; // 총 판매가
  storeFeeWon: number; // 애플/구글 몫
  sellerNetWon: number; // 셀러 정산액
  platformNetWon: number; // 플랫폼 몫
}

/** 판매가 → 정산 분배 (반올림, 잔여는 플랫폼 흡수) */
export function computeSettlement(amountWon: number): Settlement {
  const storeFeeWon = Math.round(amountWon * STORE_FEE_RATE);
  const net = amountWon - storeFeeWon;
  const sellerNetWon = Math.round(net * SELLER_SHARE);
  const platformNetWon = net - sellerNetWon;
  return { amountWon, storeFeeWon, sellerNetWon, platformNetWon };
}

// ── 환불 · 어뷰징 방어 ───────────────────────────────────────
// 구매 후에도 목록은 블러. 맛보기 외 이 개수 이상 '열람'하면 = 소비 완료 → 단순변심 환불 불가.
export const REVEAL_REFUND_THRESHOLD = 3;
// 셀러 정산 홀드: 이 기간 지난 뒤 지급 (스토어 환불되어도 현금 손해 방지)
export const SETTLEMENT_HOLD_DAYS = 14;
// 누적 환불 이 횟수 도달 시 유료지도 구매 영구 제한 (스토어 환불도 카운트)
export const REFUND_BLOCK_COUNT = 4;
