/** UI 표시용 라벨 (값 자체는 DB/도메인에서 코드값으로 저장) */

export const PRICE_RANGES: { value: string; label: string }[] = [
  { value: "under_10k", label: "1만원 이하" },
  { value: "10k_20k", label: "1~2만원" },
  { value: "20k_40k", label: "2~4만원" },
  { value: "over_40k", label: "4만원 이상" },
];

export const REVISIT_INTENTS: { value: string; label: string }[] = [
  { value: "yes", label: "또 갈래요" },
  { value: "maybe", label: "보통" },
  { value: "no", label: "글쎄요" },
];

export const WAITING_LEVELS: { value: string; label: string }[] = [
  { value: "none", label: "웨이팅 없음" },
  { value: "short", label: "조금 기다림" },
  { value: "long", label: "많이 기다림" },
];

export const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "latest", label: "최신순" },
  { value: "saves", label: "저장순" },
  { value: "likes", label: "좋아요순" },
  { value: "weekly", label: "이번 주 인기순" },
];

export function priceLabel(value?: string | null): string {
  return PRICE_RANGES.find((p) => p.value === value)?.label ?? "";
}
export function revisitLabel(value?: string | null): string {
  return REVISIT_INTENTS.find((p) => p.value === value)?.label ?? "";
}
export function waitingLabel(value?: string | null): string {
  return WAITING_LEVELS.find((p) => p.value === value)?.label ?? "";
}
