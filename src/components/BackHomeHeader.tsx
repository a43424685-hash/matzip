import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function BackHomeHeader({ title }: { title: string }) {
  return (
    <header className="mb-5 flex items-center gap-3">
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
