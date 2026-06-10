"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

/** 이전 화면으로 돌아가는 버튼. 히스토리가 없으면 fallback 경로로. */
export default function BackButton({
  fallback = "/",
  className = "",
  label = "뒤로",
}: {
  fallback?: string;
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(fallback);
      }}
      className={`flex h-9 w-9 items-center justify-center rounded-full active:scale-95 ${className}`}
    >
      <ChevronLeft size={24} strokeWidth={2.4} />
    </button>
  );
}
