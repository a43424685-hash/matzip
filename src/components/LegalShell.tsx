import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import SiteFooter from "@/components/SiteFooter";

/** 약관/개인정보/환불 등 법적 고지 페이지 공통 틀 (상단 뒤로가기 + 본문 + 푸터) */
export default function LegalShell({
  title,
  effectiveDate,
  children,
}: {
  title: string;
  effectiveDate?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="pb-10">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-stone-100 bg-white/95 px-3 py-3 backdrop-blur">
        <Link href="/" className="rounded-full p-1.5 text-ink active:bg-stone-100">
          <ChevronLeft size={22} />
        </Link>
        <h1 className="text-[16px] font-extrabold text-ink">{title}</h1>
      </header>

      <article className="prose-legal px-5 pt-5 text-[13.5px] leading-relaxed text-ink">
        {effectiveDate && <p className="mb-4 text-[12px] text-stone-400">시행일: {effectiveDate}</p>}
        {children}
      </article>

      <SiteFooter />
    </main>
  );
}
