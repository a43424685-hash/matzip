/** 커뮤니티 카테고리 상수 — 클라이언트/서버 공용(서버 모듈 import 없음). */
export const COMMUNITY_CATEGORIES = [
  { key: "recommend", label: "맛집 추천받기" },
  { key: "review", label: "후기·자랑" },
  { key: "free", label: "자유수다" },
] as const;

export type CommunityCategory = "recommend" | "review" | "free";

export function isCommunityCategory(v: string): v is CommunityCategory {
  return v === "recommend" || v === "review" || v === "free";
}

export function categoryLabel(key: string): string {
  return COMMUNITY_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}
