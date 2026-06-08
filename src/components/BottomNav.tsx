"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Trophy, MapPin, User, BadgePercent } from "lucide-react";

const TABS = [
  { href: "/benefits", label: "혜택 모음", Icon: BadgePercent },
  { href: "/search", label: "검색", Icon: Search },
  { href: "/nearby", label: "주변", Icon: MapPin },
  { href: "/rankings", label: "랭킹", Icon: Trophy },
  { href: "/me", label: "내정보", Icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md border-t border-stone-200 bg-white/95 backdrop-blur">
      <ul className="grid grid-cols-5">
        {TABS.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                  active ? "text-forest" : "text-stone-400"
                }`}
              >
                <Icon size={21} strokeWidth={active ? 2.4 : 1.9} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
