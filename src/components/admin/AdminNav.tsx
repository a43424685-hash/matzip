"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/settlements", label: "정산" },
  { href: "/admin/refunds", label: "환불" },
  { href: "/admin/reports", label: "신고·문의" },
];

export default function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="mt-2.5 flex gap-1.5">
      {TABS.map((t) => {
        const active = pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-bold ${active ? "bg-forest text-white" : "bg-stone-100 text-ink-muted"}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
