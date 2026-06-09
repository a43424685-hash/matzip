/** UI 표시용 라벨 (값 자체는 DB/도메인에서 코드값으로 저장) */

export const PRICE_RANGES: { value: string; label: string }[] = [
  { value: "under_10k", label: "1만원 이하" },
  { value: "10k_20k", label: "1~2만원" },
  { value: "20k_30k", label: "2~3만원" },
  { value: "30k_40k", label: "3~4만원" },
  { value: "40k_50k", label: "4~5만원" },
  { value: "50k_70k", label: "5~7만원" },
  { value: "70k_100k", label: "7~10만원" },
  { value: "100k_150k", label: "10~15만원" },
  { value: "150k_200k", label: "15~20만원" },
  { value: "over_200k", label: "20만원 이상 직접입력" },
];

export const REVISIT_INTENTS: { value: string; label: string }[] = [
  { value: "must", label: "무조건 또 갈래요" },
  { value: "nearby", label: "근처 가면 또 갈래요" },
  { value: "with_others", label: "누가 가자면 갈래요" },
  { value: "once_enough", label: "한 번쯤은 충분해요" },
  { value: "not_revisit", label: "딱히 두 번은 안 가도 될 것 같아요" },
  { value: "pass", label: "다음엔 다른 곳 갈래요" },
];

export const TASTE_RATINGS: { value: string; label: string }[] = [
  { value: "life_best", label: "인생 맛집급이에요" },
  { value: "great", label: "진짜 맛있어요" },
  { value: "memorable", label: "계속 생각나는 맛이에요" },
  { value: "better_than_expected", label: "기대보다 맛있었어요" },
  { value: "solid", label: "딱 기본 이상은 해요" },
  { value: "okay", label: "무난하게 괜찮아요" },
  { value: "polarizing", label: "호불호 있을 맛이에요" },
  { value: "disappointing", label: "기대보단 아쉬웠어요" },
  { value: "not_my_taste", label: "내 입맛엔 안 맞았어요" },
];

export const TASTE_TAGS: { value: string; label: string }[] = [
  { value: "clean", label: "담백하고 깔끔해요" },
  { value: "strong", label: "양념/간이 강한 편이에요" },
  { value: "stimulating", label: "자극적이지만 맛있어요" },
  { value: "visual_less_taste_more", label: "비주얼보다 맛이 좋아요" },
  { value: "visual_good_taste_okay", label: "비주얼은 좋은데 맛은 무난해요" },
  { value: "worth_price", label: "가격 생각하면 맛있어요" },
  { value: "small_portion", label: "맛은 있는데 양이 아쉬워요" },
  { value: "fresh", label: "재료가 신선해요" },
  { value: "special", label: "다른 곳과 맛이 달라요" },
  { value: "comfort", label: "편하게 먹히는 맛이에요" },
];

export const SERVICE_RATINGS: { value: string; label: string }[] = [
  { value: "kind", label: "친절하고 편했어요" },
  { value: "normal", label: "무난했어요" },
  { value: "busy", label: "바빠 보였지만 괜찮았어요" },
  { value: "uncomfortable", label: "조금 불편했어요" },
  { value: "unfriendly", label: "불친절했어요" },
  { value: "dont_expect", label: "서비스는 기대하지 마세요" },
];

export const SERVICE_TAGS: { value: string; label: string }[] = [
  { value: "fast", label: "음식이 빨리 나와요" },
  { value: "slow", label: "음식이 늦게 나와요" },
  { value: "good_explain", label: "설명을 잘해줘요" },
  { value: "order_easy", label: "주문이 편해요" },
  { value: "self_many", label: "셀프가 많은 편이에요" },
  { value: "foreigner_friendly", label: "외국인도 가기 편해요" },
  { value: "parking_helpful", label: "주차 안내가 좋아요" },
];

export const ATMOSPHERE_TAGS: { value: string; label: string }[] = [
  { value: "date", label: "데이트하기 좋아요" },
  { value: "friends", label: "친구랑 가기 좋아요" },
  { value: "solo", label: "혼밥하기 편해요" },
  { value: "family", label: "가족이랑 가기 좋아요" },
  { value: "company", label: "회식하기 좋아요" },
  { value: "photo", label: "사진 찍기 좋아요" },
  { value: "quiet", label: "조용하고 편해요" },
  { value: "lively", label: "활기차고 북적여요" },
  { value: "hip", label: "힙하고 감각적이에요" },
  { value: "old_local", label: "오래된 노포 감성이에요" },
  { value: "regular", label: "동네 단골집 느낌이에요" },
  { value: "outdoor", label: "야장 감성이 좋아요" },
  { value: "view", label: "뷰가 좋아요" },
  { value: "spacious", label: "공간이 넓어요" },
  { value: "narrow", label: "좌석이 좁은 편이에요" },
  { value: "special_day", label: "특별한 날 가기 좋아요" },
  { value: "casual", label: "가볍게 들르기 좋아요" },
  { value: "drink", label: "술 마시기 좋아요" },
  { value: "noisy", label: "대화하기엔 시끄러워요" },
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
  return (
    REVISIT_INTENTS.find((p) => p.value === value)?.label ??
    ({ yes: "또 갈래요", maybe: "보통", no: "글쎄요" } as Record<string, string>)[value ?? ""] ??
    ""
  );
}
export function waitingLabel(value?: string | null): string {
  return WAITING_LEVELS.find((p) => p.value === value)?.label ?? "";
}

export function tasteRatingLabel(value?: string | null): string {
  return TASTE_RATINGS.find((p) => p.value === value)?.label ?? "";
}
export function serviceRatingLabel(value?: string | null): string {
  return SERVICE_RATINGS.find((p) => p.value === value)?.label ?? "";
}
export function labelMany(
  values: string[] | undefined | null,
  options: { value: string; label: string }[]
): string[] {
  const map = new Map(options.map((o) => [o.value, o.label]));
  return (values ?? []).map((v) => map.get(v) ?? v).filter(Boolean);
}
