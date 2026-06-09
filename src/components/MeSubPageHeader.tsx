import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** 내 정보 하위 페이지 공통 헤더 — 뒤로가기는 항상 /me, 제목은 가운데. */
export default function MeSubPageHeader({ title }: { title: string }) {
  return (
    <header className="relative mb-5 flex h-10 items-center justify-center">
      <Link
        href="/me"
        aria-label="내 정보로"
        className="absolute left-0 flex h-10 w-10 items-center justify-center rounded-full text-ink active:scale-95"
      >
        <ArrowLeft size={22} strokeWidth={2.2} />
      </Link>
      <h1 className="text-lg font-extrabold text-ink">{title}</h1>
    </header>
  );
}
