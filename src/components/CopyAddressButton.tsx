"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

/** 주소 + 복사 버튼. 클립보드 복사 후 "복사됨" 잠깐 표시 */
export default function CopyAddressButton({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
    } catch {
      // 클립보드 권한/HTTPS 아닌 경우 폴백
      const ta = document.createElement("textarea");
      ta.value = address;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-left active:opacity-60"
      aria-label="주소 복사"
    >
      <span className="min-w-0 flex-1 text-sm text-ink">{address}</span>
      {copied ? (
        <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-forest">
          <Check size={14} /> 복사됨
        </span>
      ) : (
        <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-stone-400">
          <Copy size={13} /> 복사
        </span>
      )}
    </button>
  );
}
