/**
 * 서버 에러 추적 — Next.js 공식 훅. 서버(라우트/RSC/액션)에서 던져진 에러를 한곳에서 로깅.
 * Vercel 대시보드 Logs/Observability 에서 [SERVER-ERROR] 로 검색 가능 (무료).
 * 향후 Sentry 도입 시: SENTRY_DSN 설정 후 이 함수에서 Sentry.captureException(err) 호출만 추가.
 */
export async function onRequestError(
  err: unknown,
  request: { path?: string; method?: string },
  context: { routerKind?: string; routePath?: string; routeType?: string }
): Promise<void> {
  const e = err as { name?: string; message?: string; stack?: string } | undefined;
  console.error(
    "[SERVER-ERROR]",
    JSON.stringify({
      name: e?.name,
      message: e?.message,
      stack: e?.stack?.split("\n").slice(0, 6).join("\n"),
      path: request?.path,
      method: request?.method,
      routerKind: context?.routerKind,
      routePath: context?.routePath,
      routeType: context?.routeType,
    })
  );
}
