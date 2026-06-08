/**
 * 방문 인증 — 4종 뱃지. "음식점 자체"가 아니라 "유저의 해당 맛집 기록(RestaurantPost)"에 귀속.
 * 같은 음식점이라도 유저/기록마다 인증 상태가 다르다.
 */

export interface VerificationFlags {
  location: boolean; // 위치 인증
  photo: boolean; // 음식·현장 사진 인증
  receipt: boolean; // 영수증 인증
  menu: boolean; // 메뉴판 인증
}

export const VERIFICATION_KEYS = ["location", "photo", "receipt", "menu"] as const;
export type VerificationKey = (typeof VERIFICATION_KEYS)[number];

export const VERIFICATION_LABEL: Record<VerificationKey, string> = {
  location: "위치",
  photo: "사진",
  receipt: "영수증",
  menu: "메뉴판",
};

/** 인증된 뱃지 수 (0~4). 신뢰도/보너스 산정의 기준이 된다. */
export function verifiedBadgeCount(v: VerificationFlags): number {
  return VERIFICATION_KEYS.filter((k) => v[k]).length;
}

export function isVerified(v: VerificationFlags): boolean {
  return verifiedBadgeCount(v) > 0;
}
