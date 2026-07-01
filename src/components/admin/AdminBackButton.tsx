"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/** 어드민 헤더 뒤로가기 — 히스토리 있으면 뒤로, 없으면 어드민 홈. */
export default function AdminBackButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="뒤로"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push("/admin");
      }}
      className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:bg-stone-100 active:scale-95"
    >
      <ArrowLeft size={20} strokeWidth={2.2} />
    </button>
  );
}
