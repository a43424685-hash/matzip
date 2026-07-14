/**
 * RevenueCat REST v1 — 서버측 구매 검증.
 * 앱(클라)이 RevenueCat SDK로 결제하면, 서버는 이 헬퍼로 RevenueCat에 실제
 * 구매가 있는지(환불 안 됐는지) 확인한 뒤에만 지도를 잠금 해제한다.
 *
 * 환경변수:
 *  - REVENUECAT_REST_API_KEY : RevenueCat 대시보드 > API keys > Secret key (v1)
 *  - REVENUECAT_WEBHOOK_AUTH  : 웹훅 Authorization 헤더 검증값(대시보드에서 지정)
 *
 * app_user_id 는 우리 userId 로 통일한다(클라에서 Purchases.logIn(userId)).
 */

const BASE = "https://api.revenuecat.com/v1";

export interface RcNonSubItem {
  id: string; // RevenueCat 내부 구매 id
  store_transaction_id?: string; // 스토어 거래 ID (SDK transactionIdentifier와 매칭)
  purchase_date?: string;
  store?: string; // app_store | play_store
  is_sandbox?: boolean;
}

export interface RcSubscriber {
  non_subscriptions?: Record<string, RcNonSubItem[]>; // productId -> 소비성 구매들
  subscriber?: unknown;
}

function apiKey(): string {
  const k = process.env.REVENUECAT_REST_API_KEY;
  if (!k) throw new Error("REVENUECAT_REST_API_KEY 미설정");
  return k;
}

/** RevenueCat 구독자(=우리 userId) 조회 */
export async function getSubscriber(appUserId: string): Promise<RcSubscriber | null> {
  const res = await fetch(`${BASE}/subscribers/${encodeURIComponent(appUserId)}`, {
    headers: { Authorization: `Bearer ${apiKey()}`, Accept: "application/json" },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`RevenueCat ${res.status}`);
  const data = await res.json().catch(() => ({}));
  return (data.subscriber ?? null) as RcSubscriber | null;
}

export interface VerifiedPurchase {
  productId: string;
  storeTransactionId: string;
  store: string | null;
}

/**
 * 이 유저가 productId 상품을 '이 거래ID로' 실제 구매했는지 확인.
 * storeTransactionId 가 주어지면 정확히 그 거래를 찾고, 없으면 해당 상품의
 * 가장 최근 구매를 반환(폴백). 못 찾으면 null.
 */
export async function verifyConsumable(
  appUserId: string,
  productId: string,
  storeTransactionId?: string,
): Promise<VerifiedPurchase | null> {
  const sub = await getSubscriber(appUserId);
  const items = sub?.non_subscriptions?.[productId];
  if (!items || items.length === 0) return null;

  let match: RcNonSubItem | undefined;
  if (storeTransactionId) {
    match = items.find(
      (i) => i.store_transaction_id === storeTransactionId || i.id === storeTransactionId,
    );
  }
  // 폴백: 가장 최근 구매 (거래ID 매칭 실패 시 — 스토어별 ID 포맷 차이 대비)
  if (!match) {
    match = [...items].sort(
      (a, b) => (b.purchase_date ?? "").localeCompare(a.purchase_date ?? ""),
    )[0];
  }
  if (!match) return null;
  return {
    productId,
    storeTransactionId: match.store_transaction_id ?? match.id,
    store: match.store ?? null,
  };
}

/** 웹훅 Authorization 헤더 검증 */
export function verifyWebhookAuth(header: string | null): boolean {
  const expected = process.env.REVENUECAT_WEBHOOK_AUTH;
  if (!expected) return false;
  return header === expected || header === `Bearer ${expected}`;
}

// RevenueCat 웹훅 이벤트 중 '환불/취소(=접근 회수)'로 취급할 타입
export const REFUND_EVENT_TYPES = new Set(["CANCELLATION", "REFUND", "EXPIRATION"]);
