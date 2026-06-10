/**
 * 포트원(PortOne) V2 서버 헬퍼.
 * 결제 검증은 반드시 서버에서 PortOne REST API로 실제 결제 상태를 조회해 확인한다.
 * (클라이언트가 보낸 금액/성공여부를 그대로 믿지 않음 — 위변조 방지)
 */
const API_BASE = "https://api.portone.io";

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
