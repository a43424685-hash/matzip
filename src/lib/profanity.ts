/**
 * 간단 욕설/성적 표현 필터 (1차 방어 — 완벽하지 않음).
 * 공백·기호 우회를 일부 정규화해서 잡는다. 과차단을 피하려 강한 표현 위주로 구성.
 */
const BANNED = [
  // 욕설
  "씨발", "시발", "씨빨", "시1발", "ㅆㅂ", "ㅅㅂ", "개새끼", "개색", "새끼", "썅", "씹",
  "좆", "좇", "조까", "병신", "ㅂㅅ", "지랄", "ㅈㄹ", "닥쳐", "꺼져", "엿먹",
  "느금", "니애미", "니애비", "엠창", "애미", "fuck", "shit", "bitch", "asshole",
  // 성적 표현
  "보지", "자지", "섹스", "야동", "후장", "딸딸", "자위", "성기", "포르노", "porn", "sex",
];

/** 욕설/성적 표현 포함 여부 */
export function containsProfanity(text: string): boolean {
  if (!text) return false;
  // 공백·일부 기호 제거 + 소문자 (간단 우회 차단)
  const normalized = text.toLowerCase().replace(/[\s._*~\-^]/g, "");
  return BANNED.some((w) => normalized.includes(w));
}
