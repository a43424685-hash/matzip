"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { GA_ID, pageview, track } from "@/lib/analytics";

/**
 * GA4 로더 + SPA 페이지 조회 추적.
 * NEXT_PUBLIC_GA_ID 없으면 아무것도 렌더하지 않음(완전 무해).
 * layout 에서 <Suspense> 로 감싸 사용 (useSearchParams 요구).
 */
export default function Analytics() {
  const pathname = usePathname();
  const search = useSearchParams();

  useEffect(() => {
    if (!GA_ID) return;
    const qs = search.toString();
    pageview(qs ? `${pathname}?${qs}` : pathname);
  }, [pathname, search]);

  // 가입 완료(?signup=1) → 전환 이벤트 1회 + URL에서 파라미터 제거
  useEffect(() => {
    if (search.get("signup") !== "1") return;
    track("sign_up");
    const url = new URL(window.location.href);
    url.searchParams.delete("signup");
    window.history.replaceState(null, "", url.pathname + (url.search ? url.search : ""));
  }, [search]);

  if (!GA_ID) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}',{send_page_view:false});`}
      </Script>
    </>
  );
}
