"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

export default function StoreSearchBar({ initial = "" }: { initial?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const v = q.trim();
        router.push(v ? `/store?q=${encodeURIComponent(v)}` : "/store");
      }}
      className="flex h-12 items-center gap-2 rounded-full bg-stone-100 px-4"
    >
      <Search size={18} className="shrink-0 text-stone-400" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="지역·테마·만든이 검색 (예: 강남 데이트)"
        className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-ink outline-none placeholder:text-stone-400"
      />
    </form>
  );
}
