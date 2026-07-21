import { Check } from "lucide-react";

/** 운영자(공식 계정) 마크 — 파란 동그라미 + 흰 체크. 닉네임 옆에 붙인다. */
export default function OfficialBadge({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      aria-label="공식 운영자"
      title="공식 운영자"
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-ink text-white ${className}`}
      style={{ width: size, height: size }}
    >
      <Check size={Math.round(size * 0.68)} strokeWidth={3.5} />
    </span>
  );
}
