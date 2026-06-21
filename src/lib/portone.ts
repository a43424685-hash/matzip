/**
 * 포트원(PortOne) V2 서버 헬퍼.
 * 결제 검증은 반드시 서버에서 PortOne REST API로 실제 결제 상태를 조회해 확인한다.
 * (클라이언트가 보낸 금액/성공여부를 그대로 믿지 않음 — 위변조 방지)
 */
import { createHmac, timingSafeEqual } from "crypto";

const API_BASE = "https://api.portone.io";

/**
 * 웹훅 서명 검증 — PortOne V2는 Standard Webhooks 스펙을 따른다.
 *  헤더: webhook-id / webhook-timestamp / webhook-signature ("v1,<base64sig> ...")
 *  서명: HMAC-SHA256(secret, `${id}.${timestamp}.${rawBody}`) → base64
 *  시크릿: whsec_<base64> (PORTONE_WEBHOOK_SECRET)
 * 반드시 raw 텍스트 body로 검증해야 한다(JSON 재직렬화 금지).
 */
export function verifyPortOneWebhook(
  rawBody: string,
  headers: Headers
): { ok: boolean; reason?: string } {
  const secret = process.env.PORTONE_WEBHOOK_SECRET;
  if (!secret) return { ok: false, reason: "NO_SECRET" };

  const id = headers.get("webhook-id") || headers.get("svix-id");
  const timestamp = headers.get("webhook-timestamp") || headers.get("svix-timestamp");
  const sigHeader = headers.get("webhook-signature") || headers.get("svix-signature");
  if (!id || !timestamp || !sigHeader) return { ok: false, reason: "MISSING_HEADERS" };

  // 재전송 공격 방지 — 타임스탬프 ±5분 허용
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
    return { ok: false, reason: "TIMESTAMP" };
  }

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest("base64");
  const expectedBuf = Buffer.from(expected);

  // "v1,<sig> v1,<sig2>" 중 하나라도 일치하면 통과 (timing-safe)
  const match = sigHeader.split(" ").some((part) => {
    const sig = part.includes(",") ? part.split(",")[1] : part;
    const buf = Buffer.from(sig);
    return buf.length === expectedBuf.length && timingSafeEqual(buf, expectedBuf);
  });
  return match ? { ok: true } : { ok: false, reason: "SIGNATURE" };
}

export interface PortOnePayment {
  status: string; // "PAID" | "READY" | "FAILED" | "CANCELLED" ...
  currency?: string; // "KRW"
  amount?: { total?: number };
  customData?: string; // 우리가 requestPayment 때 넣은 JSON 문자열
  channel?: { pgProvider?: string };
  method?: { provider?: string };
}

/** 결제 취소(환불). 전액 취소. */
export async function cancelPortOnePayment(paymentId: string, reason: string): Promise<void> {
  const secret = process.env.PORTONE_API_SECRET;
  if (!secret) throw new Error("PORTONE_API_SECRET_MISSING");
  const res = await fetch(`${API_BASE}/payments/${encodeURIComponent(paymentId)}/cancel`, {
    method: "POST",
    headers: { Authorization: `PortOne ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`PORTONE_CANCEL_FAILED ${res.status} ${body}`);
  }
}

/** 결제 단건 조회 */
export async function getPortOnePayment(paymentId: string): Promise<PortOnePayment> {
  const secret = process.env.PORTONE_API_SECRET;
  if (!secret) throw new Error("PORTONE_API_SECRET_MISSING");
  const res = await fetch(`${API_BASE}/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `PortOne ${secret}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`PORTONE_FETCH_FAILED ${res.status} ${body}`);
  }
  return (await res.json()) as PortOnePayment;
}
