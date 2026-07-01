import { NextResponse, type NextRequest } from "next/server";

/**
 * CSRF/요청위조 방어 — 쿠키 세션 기반 상태변경 API 보호.
 * 상태변경 메서드(POST/PUT/PATCH/DELETE)는 same-origin 요청만 허용한다.
 *  - Origin 헤더 우선, 없으면 Referer 로 보조 확인 → 그 host 가 요청 host 와 같아야 함.
 *  - host 를 직접 비교하므로 preview/production/앱 도메인을 하드코딩할 필요가 없다.
 *  - 외부 웹훅/콜백(브라우저 요청 아님)은 예외.
 */
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// 외부에서 직접 호출되는(브라우저 same-origin 아님) 엔드포인트 — 자체 서명/검증으로 보호됨
const EXEMPT_PREFIXES = [
  "/api/payments/webhook", // PortOne 웹훅(서명 검증)
  "/api/auth/apple/callback", // Apple form_post 콜백
];

function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

export function middleware(req: NextRequest) {
  if (!MUTATING.has(req.method)) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (EXEMPT_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const reqHost = req.headers.get("host");
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");

  // Origin 우선, 없으면 Referer 보조. 둘 다 없으면(브라우저 요청 아님) 차단.
  const sourceHost = hostOf(origin) ?? hostOf(referer);
  if (!sourceHost || !reqHost || sourceHost !== reqHost) {
    return NextResponse.json({ error: "CROSS_ORIGIN", message: "요청 출처가 확인되지 않았어요." }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
