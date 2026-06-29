/**
 * 방문 인증 — 3종 뱃지(위치/영수증/메뉴판). "음식점 자체"가 아니라
 * "유저의 해당 맛집 기록(RestaurantPost)"에 귀속. 같은 가게라도 기록마다 인증 상태가 다르다.
 * (음식·현장 사진 인증은 폐지 — 음식/가게 전경은 '등록 사진'으로 대체)
 */

export interface VerificationFlags {
  location: boolean; // 위치 인증
  receipt: boolean; // 영수증 인증
  menu: boolean; // 메뉴판 인증
}

// 영수증 인증은 제거(개인정보 노출 위험·과한 마찰) → 위치·메뉴판만 노출.
// (VerificationFlags.receipt 필드는 기존 데이터 호환 위해 남겨두되, 어디서도 표시·집계하지 않음)
export const VERIFICATION_KEYS = ["location", "menu"] as const;
export type VerificationKey = (typeof VERIFICATION_KEYS)[number];

export const VERIFICATION_LABEL: Record<VerificationKey, string> = {
  location: "위치",
  menu: "메뉴판",
};

/** 인증된 뱃지 수 (0~3). 신뢰도/보너스 산정의 기준이 된다. */
export function verifiedBadgeCount(v: VerificationFlags): number {
  return VERIFICATION_KEYS.filter((k) => v[k]).length;
}

export function isVerified(v: VerificationFlags): boolean {
  return verifiedBadgeCount(v) > 0;
}
