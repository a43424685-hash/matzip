/**
 * ImageVerificationService — 증거 사진 검증 (엉뚱한 사진 차단).
 *  - 영수증: Anthropic Claude 비전으로 실제 영수증인지 + 가게명이 등록 가게와 일치하는지
 *    (OCR 대조), 날짜 추출. **fail-closed** — 키 미설정/API·모델 오류/판독 실패 시 모두 거부.
 *  - 음식·현장 사진 / 메뉴판: AI 미사용. 위치 인증 + 현장 카메라 촬영 게이팅으로 통과 (B 합의, 비용 절감).
 */

export type ProofKind = "receipt" | "menu";

export interface ProofVerdict {
  ok: boolean;
  reason: string;
  extracted?: { storeName?: string | null; date?: string | null };
}

const MODEL = "claude-haiku-4-5-20251001";

function parseDataUrl(dataUrl: string): { mediaType: string; base64: string } | null {
  const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!m) return null;
  return { mediaType: m[1], base64: m[2] };
}

/** Claude 비전 호출 → 모델의 텍스트 응답 반환 (실패 시 null) */
async function callVision(dataUrl: string, prompt: string): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key.startsWith("여기에")) return null;
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        system:
          "너는 음식점 방문 인증용 사진 검수자다. 반드시 JSON 객체 하나만 출력한다. 설명/마크다운 금지.",
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: parsed.mediaType, data: parsed.base64 } },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = data.content?.find((c) => c.type === "text")?.text;
    return text ?? null;
  } catch {
    return null;
  }
}

function parseJson<T>(text: string | null): T | null {
  if (!text) return null;
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as T;
  } catch {
    return null;
  }
}

function hasApiKey(): boolean {
  const k = process.env.ANTHROPIC_API_KEY;
  return !!k && !k.startsWith("여기에");
}

/**
 * 증거 사진 검증. ok=false 면 첨부 거부.
 *  - 음식·메뉴판: 위치 인증 + 현장 카메라 촬영으로 이미 보장 → AI 호출 안 함(비용 절감, B 합의).
 *  - 영수증: AI OCR 로 상호명·날짜 대조. fail-closed — 키 미설정/오류/판독 실패 시 거부.
 */
export async function verifyProofImage(
  kind: ProofKind,
  dataUrl: string,
  restaurantName: string
): Promise<ProofVerdict> {
  // 메뉴판 → AI 미사용, 통과 (현장 카메라+위치 게이팅으로 인정)
  if (kind === "menu") {
    return { ok: true, reason: "현장 카메라 촬영 + 위치 인증으로 확인" };
  }

  // 영수증 → AI 필수 (fail-closed)
  if (!hasApiKey()) {
    return { ok: false, reason: "영수증 인증이 아직 설정되지 않았어요. 잠시 후 다시 시도해주세요." };
  }
  const prompt =
    `이 이미지가 음식점 영수증인지 검증해줘. 사용자는 '${restaurantName}' 영수증이라고 주장해.\n` +
    `영수증의 상호명과 날짜를 읽고, 상호명이 '${restaurantName}' 와 합리적으로 일치하는지 판단해.\n` +
    `JSON만 출력: {"isReceipt": true/false, "storeName": "읽은 상호명 또는 null", "date": "YYYY-MM-DD 또는 null", "storeMatches": true/false, "reason": "한국어 한 문장"}`;
  const v = parseJson<{ isReceipt: boolean; storeName?: string; date?: string; storeMatches: boolean; reason?: string }>(
    await callVision(dataUrl, prompt)
  );
  // 판독 실패(API/모델/JSON 오류) → 거부 (fail-closed)
  if (!v) return { ok: false, reason: "영수증 확인에 실패했어요. 잠시 후 다시 시도해주세요." };
  if (!v.isReceipt) return { ok: false, reason: v.reason || "영수증 사진이 아니에요." };
  if (!v.storeMatches)
    return {
      ok: false,
      reason: v.reason || `영수증 상호명이 '${restaurantName}' 와 달라요.`,
      extracted: { storeName: v.storeName, date: v.date },
    };
  return { ok: true, reason: "영수증 인증 통과", extracted: { storeName: v.storeName, date: v.date } };
}
