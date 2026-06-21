"use client";

import { useRouter } from "next/navigation";
import { markScrollReset } from "@/lib/scrollReset";

/**
 * '작업 끝낸 화면'(수정·등록완료 등)에서 나갈 때 쓰는 버튼.
 * push 가 아니라 router.replace 로 이동해, 그 화면이 히스토리에 남지 않게 한다.
 * (→ 다음 화면에서 뒤로가기 했을 때 방금 끝낸 작업 화면으로 되돌아가는 루프를 막음)
 */
export default function ReplaceLink({
  href,
  className,
  ariaLabel,
  children,
}: {
  href: string;
  className?: string;
  ariaLabel?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={() => {
        markScrollReset();
        router.replace(href);
      }}
      className={className}
    >
      {children}
    </button>
  );
}
