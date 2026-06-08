import { z } from "zod";

const BLOCKED_WORDS = [
  "씨발",
  "시발",
  "ㅅㅂ",
  "개새",
  "병신",
  "븅신",
  "좆",
  "존나",
  "지랄",
  "보지",
  "자지",
  "섹스",
  "야동",
  "강간",
  "창녀",
  "admin",
  "administrator",
  "운영자",
  "관리자",
];

function normalizeNickname(value: string): string {
  return value.toLowerCase().replace(/[\s._\-~!@#$%^&*()[\]{}|\\:;"'<>,.?/`]+/g, "");
}

export function hasBlockedNicknameWord(value: string): boolean {
  const normalized = normalizeNickname(value);
  return BLOCKED_WORDS.some((word) => normalized.includes(normalizeNickname(word)));
}

export const nicknameSchema = z
  .string()
  .trim()
  .min(2, "닉네임은 2자 이상이어야 합니다.")
  .max(12, "닉네임은 12자 이하여야 합니다.")
  .regex(/^[가-힣a-zA-Z0-9]+$/, "닉네임은 한글, 영문, 숫자만 가능합니다.")
  .refine((value) => !hasBlockedNicknameWord(value), {
    message: "사용할 수 없는 닉네임입니다.",
  });
