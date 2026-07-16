"use client";

/**
 * 앱(네이티브) 인앱결제 클라이언트 — RevenueCat SDK 래퍼.
 * 웹 브라우저에선 결제 불가(네이티브에서만) → isNativeApp() 으로 분기.
 *
 * 환경변수(공개키, NEXT_PUBLIC_):
 *  - NEXT_PUBLIC_REVENUECAT_IOS_KEY     : RevenueCat > iOS 앱 공개 API 키(appl_...)
 *  - NEXT_PUBLIC_REVENUECAT_ANDROID_KEY : RevenueCat > Android 앱 공개 API 키(goog_...)
 */
import { Capacitor } from "@capacitor/core";
import { Purchases, PRODUCT_CATEGORY } from "@revenuecat/purchases-capacitor";

/** 네이티브 앱(iOS/Android) 안에서 실행 중인가 — 웹 브라우저면 false */
export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

let configuredFor: string | null = null;

async function ensureConfigured(userId: string) {
  const platform = Capacitor.getPlatform(); // 'ios' | 'android'
  const apiKey =
    platform === "ios"
      ? process.env.NEXT_PUBLIC_REVENUECAT_IOS_KEY
      : process.env.NEXT_PUBLIC_REVENUECAT_ANDROID_KEY;
  if (!apiKey) throw new Error("결제 설정이 아직 준비되지 않았어요.");
  if (configuredFor === userId) return;
  if (configuredFor === null) {
    await Purchases.configure({ apiKey, appUserID: userId });
  } else {
    await Purchases.logIn({ appUserID: userId }); // 계정 전환
  }
  configuredFor = userId;
}

export interface IapResult {
  transactionId?: string;
  platform: string;
}

/** 지도 상품 결제 — 성공 시 스토어 거래ID 반환(서버 검증용). 취소/실패는 throw. */
export async function purchaseMapProduct(userId: string, productId: string): Promise<IapResult> {
  const platform = Capacitor.getPlatform();
  await ensureConfigured(userId);
  const { products } = await Purchases.getProducts({
    productIdentifiers: [productId],
    type: PRODUCT_CATEGORY.NON_SUBSCRIPTION,
  });
  const product = products?.[0];
  if (!product) throw new Error("상품을 찾을 수 없어요. 잠시 후 다시 시도해 주세요.");
  const res = await Purchases.purchaseStoreProduct({ product });
  return { transactionId: res?.transaction?.transactionIdentifier, platform };
}

/**
 * 스토어 구매 복원 — 결제는 됐는데 서버 확정이 끊긴 경우
 * (confirm 네트워크 오류, 자녀 보호 '승인 대기' 후 승인 완료 등).
 * 복원 후 서버 confirm 을 다시 호출하면 RevenueCat 검증으로 잠금이 풀린다.
 */
export async function restoreMapPurchases(userId: string): Promise<void> {
  await ensureConfigured(userId);
  await Purchases.restorePurchases();
}
