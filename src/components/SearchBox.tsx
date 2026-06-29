"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X, Clock } from "lucide-react";

const RECENT_KEY = "mgp:recentSearches";
const MAX_RECENT = 8;

function loadRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
function saveRecent(list: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch {
    /* ignore */
  }
}

/**
 * 검색 입력칸 — 최근 검색어 + 자동완성.
 * name="q" 유지 → 기존 GET 폼에 그대로 제출됨. 검색 실행 시(q 있을 때) 최근검색에 저장.
 */
export default function SearchBox({ initialQ = "" }: { initialQ?: string }) {
  const [value, setValue] = useState(initialQ);
  const [recent, setRecent] = useState<string[]>([]);
  const [suggest, setSuggest] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);

  // 검색이 실행된 화면(q 있음)이면 최근 검색에 저장
  useEffect(() => {
    const cur = loadRecent();
    const term = initialQ.trim();
    if (term) {
      const next = [term, ...cur.filter((x) => x !== term)].slice(0, MAX_RECENT);
      saveRecent(next);
      setRecent(next);
    } else {
      setRecent(cur);
    }
  }, [initialQ]);

  // 바깥 클릭 시 닫기
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function onChange(v: string) {
    setValue(v);
    setOpen(true);
    window.clearTimeout(timer.current);
    if (!v.trim()) {
      setSuggest([]);
      return;
    }
    timer.current = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(v.trim())}`);
        const d = await res.json();
        setSuggest(Array.isArray(d.suggestions) ? d.suggestions : []);
      } catch {
        setSuggest([]);
      }
    }, 180);
  }

  function submitWith(q: string) {
    setOpen(false);
    setValue(q);
    const input = inputRef.current;
    if (!input) return;
    input.value = q;
    // 폼 GET 제출 → 검색 실행
    requestAnimationFrame(() => input.form?.requestSubmit());
  }

  function removeRecent(term: string) {
    const next = recent.filter((x) => x !== term);
    saveRecent(next);
    setRecent(next);
  }

  const showRecent = open && !value.trim() && recent.length > 0;
  const showSuggest = open && value.trim().length > 0 && suggest.length > 0;

  return (
    <div ref={boxRef} className="relative">
      <Search size={18} className="pointer-events-none absolute left-3.5 top-6 -translate-y-1/2 text-stone-400" />
      <input
        ref={inputRef}
        name="q"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder="지역·상호명·분류로 검색 (예: 강남 노포)"
        className="input h-12 !pl-10"
        autoComplete="off"
      />

      {(showRecent || showSuggest) && (
        <div className="absolute left-0 right-0 top-[52px] z-30 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-lg">
          {showRecent && (
            <>
              <div className="flex items-center justify-between px-3.5 pb-1 pt-2.5 text-[11px] font-semibold text-stone-400">
                <span>최근 검색</span>
                <button
                  type="button"
                  onClick={() => {
                    saveRecent([]);
                    setRecent([]);
                  }}
                >
                  전체 삭제
                </button>
              </div>
              {recent.map((t) => (
                <div key={t} className="flex items-center hover:bg-stone-50">
                  <button
                    type="button"
                    onClick={() => submitWith(t)}
                    className="flex flex-1 items-center gap-2 px-3.5 py-2.5 text-left text-sm text-ink"
                  >
                    <Clock size={14} className="shrink-0 text-stone-400" />
                    <span className="truncate">{t}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeRecent(t)}
                    aria-label="삭제"
                    className="px-3 py-2.5 text-stone-300"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </>
          )}
          {showSuggest &&
            suggest.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => submitWith(t)}
                className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm text-ink hover:bg-stone-50"
              >
                <Search size={14} className="shrink-0 text-stone-400" />
                <span className="truncate">{t}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
