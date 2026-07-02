import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function BackHomeHeader({ title }: { title: string }) {
  return (
    <header className="sticky top-0 z-20 -mx-5 mb-4 flex items-center gap-3 border-b border-stone-100 bg-white/95 px-5 py-3 backdrop-blur">
      <Link
        href="/"
        aria-label="홈으로"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-100 text-ink active:scale-95"
      >
        <ArrowLeft size={21} strokeWidth={2.2} />
      </Link>
      <h1 className="text-xl font-extrabold text-ink">{title}</h1>
    </header>
  );
}
