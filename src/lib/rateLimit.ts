/**
 * 간단 레이트리밋 — 로그인/가입 브루트포스·스팸 1차 방어.
 *
 * 서버리스 특성상 인스턴스별 메모리라 완전하진 않지만(웜 인스턴스 내에서만 유효),
 * 짧은 시간의 기계적 대입 공격을 싸게 걸러낸다. 계정 단위 잠금은 DB(User.loginFailCount)로
 * 별도 처리(auth 라우트)하므로 이 헬퍼는 IP 단위 보조 방어다.
 */

const buckets = new Map<string, { count: number; resetAt: number }>();

/** key에 대해 windowMs 동안 limit회 초과 시 false. */
export function allowRate(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    // 메모리 누수 방지 — 커지면 만료 버킷 정리
    if (buckets.size > 10_000) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    }
    return true;
  }
  b.count += 1;
  return b.count <= limit;
}

/** 요청에서 클라이언트 IP 추출 (Vercel: x-forwarded-for 첫 항목) */
export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}
