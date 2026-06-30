"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/** 내 정보 하위 페이지 공통 헤더 — 뒤로가기는 "온 곳"으로(브라우저 히스토리). 제목 가운데. */
export default function MeSubPageHeader({ title }: { title: string }) {
  const router = useRouter();
  return (
    <header className="relative mb-5 flex h-10 items-center justify-center">
      <button
        type="button"
        onClick={() => router.back()}
        aria-label="뒤로"
        className="absolute left-0 flex h-10 w-10 items-center justify-center rounded-full text-ink active:scale-95"
      >
        <ArrowLeft size={22} strokeWidth={2.2} />
      </button>
      <h1 className="text-lg font-extrabold text-ink">{title}</h1>
    </header>
  );
}
