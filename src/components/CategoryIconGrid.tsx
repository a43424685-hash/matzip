"use client";

import Link from "next/link";
import { ChevronDown, X } from "lucide-react";

interface CategoryIconItem {
  id: string;
  name: string;
}

const ICON_ORDER = ["노포", "야장", "가성비", "데이트", "혼밥", "카페", "술집", "회식", "비오는날", "부모님"];
const LABELS: Record<string, string> = {
  "비 오는 날": "비오는날",
  "부모님 모시기 좋음": "부모님",
};

function keyOf(name: string): string {
  return (LABELS[name] ?? name).replace(/\s/g, "");
}

export default function CategoryIconGrid({ categories }: { categories: CategoryIconItem[] }) {
  const byName = new Map(categories.map((c) => [keyOf(c.name), c]));
  const items = ICON_ORDER.map((name) => byName.get(name)).filter(
    (item): item is CategoryIconItem => Boolean(item)
  );

  if (items.length === 0) return null;

  // 상단 카테고리(스크롤하면 자연스럽게 사라짐). 예전의 'fixed 복사본'은
  // 스크롤 시 상태바 파고듦·본문 가림 버그가 있어 제거함.
  return (
    <section className="px-5 pt-5">
      <CategoryPanel items={items} expanded />
    </section>
  );
}

function CategoryPanel({
  items,
  expanded,
  compact,
  onMore,
  onClose,
}: {
  items: CategoryIconItem[];
  expanded: boolean;
  compact?: boolean;
  onMore?: () => void;
  onClose?: () => void;
}) {
  const visible = expanded ? items : items.slice(0, 4);

  return (
    <div className="relative">
      {compact && expanded && onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="카테고리 접기"
          className="absolute -bottom-5 left-1/2 z-10 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-stone-200 bg-white text-ink shadow-sm"
        >
          <X size={16} />
        </button>
      )}
      <div
        className={`bg-white ${
          compact
            ? "border-b border-stone-100"
            : "rounded-[22px] px-2 py-4 shadow-[0_8px_24px_rgba(28,36,33,0.08)] ring-1 ring-stone-100"
        }`}
      >
      <div className="grid grid-cols-5 gap-y-4">
        {visible.map((item) => (
          <CategoryButton key={item.id} item={item} />
        ))}
        {!expanded && onMore && (
          <button type="button" onClick={onMore} className="flex min-w-0 flex-col items-center gap-1.5">
            <span className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-stone-50 shadow-[inset_0_-5px_10px_rgba(28,36,33,0.05),0_8px_16px_rgba(28,36,33,0.07)]">
              <span className="text-2xl font-black tracking-widest text-ink">...</span>
            </span>
            <span className="text-center text-[12px] font-extrabold text-ink">더보기</span>
          </button>
        )}
      </div>
      </div>
    </div>
  );
}

function CategoryButton({ item }: { item: CategoryIconItem }) {
  const key = keyOf(item.name);
  const label = LABELS[item.name] ?? item.name;
  return (
    <Link href={`/search?categoryIds=${item.id}`} className="flex min-w-0 flex-col items-center gap-1.5">
      <Category3DIcon name={key} />
      <span className="max-w-[58px] truncate text-center text-[12px] font-extrabold text-ink">
        {label}
      </span>
    </Link>
  );
}

function Category3DIcon({ name }: { name: string }) {
  return (
    <span className="relative flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-gradient-to-br from-stone-50 to-white shadow-[inset_0_-5px_10px_rgba(28,36,33,0.06),0_8px_16px_rgba(28,36,33,0.08)]">
      <svg viewBox="0 0 64 64" className="h-10 w-10 drop-shadow-[0_5px_5px_rgba(28,36,33,0.18)]">
        <defs>
          <linearGradient id={`red-${name}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#ff7968" />
            <stop offset="100%" stopColor="#e0533f" />
          </linearGradient>
          <linearGradient id={`green-${name}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#3d7b66" />
            <stop offset="100%" stopColor="#234b3f" />
          </linearGradient>
          <linearGradient id={`yellow-${name}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#ffd76a" />
            <stop offset="100%" stopColor="#f3a52f" />
          </linearGradient>
          <linearGradient id={`blue-${name}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#8bd6ff" />
            <stop offset="100%" stopColor="#438fc9" />
          </linearGradient>
        </defs>
        <IconShape name={name} />
      </svg>
    </span>
  );
}

function IconShape({ name }: { name: string }) {
  if (name === "노포") {
    return (
      <>
        <rect x="12" y="15" width="40" height="34" rx="8" fill={`url(#green-${name})`} />
        <rect x="18" y="22" width="28" height="10" rx="3" fill="#fff4d8" />
        <path d="M22 39h20" stroke="#fff4d8" strokeWidth="4" strokeLinecap="round" />
        <circle cx="43" cy="43" r="4" fill={`url(#yellow-${name})`} />
      </>
    );
  }
  if (name === "야장") {
    return (
      <>
        <path d="M12 28c5-13 27-18 40 0Z" fill={`url(#red-${name})`} />
        <path d="M32 28v24" stroke="#234b3f" strokeWidth="5" strokeLinecap="round" />
        <rect x="18" y="42" width="28" height="10" rx="4" fill={`url(#yellow-${name})`} />
        <circle cx="24" cy="52" r="3" fill="#234b3f" />
        <circle cx="40" cy="52" r="3" fill="#234b3f" />
      </>
    );
  }
  if (name === "가성비") {
    return (
      <>
        <rect x="10" y="25" width="34" height="24" rx="6" fill={`url(#green-${name})`} />
        <circle cx="44" cy="24" r="12" fill={`url(#yellow-${name})`} />
        <path d="M39 24h10M44 19v10" stroke="#8a5a00" strokeWidth="3" strokeLinecap="round" />
        <rect x="16" y="33" width="17" height="4" rx="2" fill="#fff" opacity=".82" />
      </>
    );
  }
  if (name === "데이트") {
    return (
      <>
        <ellipse cx="32" cy="42" rx="22" ry="10" fill="#f5eee9" />
        <path d="M32 22c-10-9-24 5 0 24 24-19 10-33 0-24Z" fill={`url(#red-${name})`} />
      </>
    );
  }
  if (name === "혼밥") {
    return (
      <>
        <circle cx="32" cy="34" r="16" fill="#fff6df" />
        <path d="M22 34c7 5 17 5 24 0" stroke="#d6c4a8" strokeWidth="5" strokeLinecap="round" />
        <path d="M16 17v35M48 17v35" stroke="#234b3f" strokeWidth="4" strokeLinecap="round" />
        <rect x="19" y="47" width="26" height="7" rx="3" fill={`url(#yellow-${name})`} />
      </>
    );
  }
  if (name === "카페") {
    return (
      <>
        <rect x="13" y="25" width="30" height="23" rx="8" fill="#fff4d8" />
        <path d="M42 30h5a6 6 0 0 1 0 12h-5" fill="none" stroke={`url(#red-${name})`} strokeWidth="5" />
        <path d="M22 17c-3 5 4 5 1 10M32 15c-3 5 4 5 1 10" stroke="#234b3f" strokeWidth="3" strokeLinecap="round" />
      </>
    );
  }
  if (name === "술집") {
    return (
      <>
        <rect x="19" y="18" width="25" height="38" rx="8" fill={`url(#yellow-${name})`} />
        <path d="M43 29h4a7 7 0 0 1 0 14h-4" fill="none" stroke="#234b3f" strokeWidth="5" />
        <rect x="23" y="18" width="17" height="10" rx="5" fill="#fff" />
      </>
    );
  }
  if (name === "회식") {
    return (
      <>
        <rect x="12" y="34" width="40" height="17" rx="8" fill={`url(#green-${name})`} />
        <circle cx="20" cy="25" r="7" fill={`url(#yellow-${name})`} />
        <circle cx="32" cy="23" r="8" fill={`url(#yellow-${name})`} />
        <circle cx="44" cy="25" r="7" fill={`url(#yellow-${name})`} />
        <path d="M18 41h28" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".78" />
      </>
    );
  }
  if (name === "비오는날") {
    return (
      <>
        <path d="M13 25c5-11 25-15 39 0Z" fill={`url(#red-${name})`} />
        <path d="M32 25v16c0 7-10 7-10 0" fill="none" stroke="#234b3f" strokeWidth="4" strokeLinecap="round" />
        <ellipse cx="38" cy="47" rx="15" ry="8" fill="#fff4d8" />
        <path d="M29 47h18" stroke={`url(#red-${name})`} strokeWidth="4" strokeLinecap="round" />
      </>
    );
  }
  return (
    <>
      <rect x="11" y="34" width="42" height="16" rx="8" fill={`url(#yellow-${name})`} />
      <circle cx="23" cy="27" r="10" fill="#fff4d8" />
      <circle cx="41" cy="27" r="10" fill="#fff4d8" />
      <path d="M20 28h24" stroke="#234b3f" strokeWidth="4" strokeLinecap="round" />
      <path d="M18 42h28" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".78" />
    </>
  );
}
