import { MapPin, Receipt, BookOpen, type LucideIcon } from "lucide-react";
import {
  VERIFICATION_KEYS,
  VERIFICATION_LABEL,
  type VerificationFlags,
} from "@/lib/verification";

const ICON: Record<string, LucideIcon> = {
  location: MapPin,
  receipt: Receipt,
  menu: BookOpen,
};

/**
 * 방문 인증 뱃지. 인증된 항목만 조용히 표시.
 * 인증이 하나도 없으면 기본은 아무것도 안 보이고(과한 강조 X),
 * showUnverified 일 때만 작고 흐린 "미인증" 라벨.
 */
export default function VerificationBadges({
  v,
  compact = false,
  showUnverified = false,
}: {
  v: VerificationFlags;
  compact?: boolean;
  showUnverified?: boolean;
}) {
  const keys = VERIFICATION_KEYS.filter((k) => v[k]);

  if (keys.length === 0) {
    return showUnverified ? (
      <span className="text-[11px] text-stone-400">미인증 기록</span>
    ) : null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {keys.map((k) => {
        const Icon = ICON[k];
        return (
          <span
            key={k}
            className={
              compact
                ? "inline-flex items-center gap-0.5 rounded-md bg-forest-soft px-1.5 py-0.5 text-[10px] font-bold text-forest"
                : "inline-flex items-center gap-1 rounded-md bg-forest-soft px-2 py-1 text-xs font-semibold text-forest"
            }
          >
            <Icon size={compact ? 11 : 13} /> {VERIFICATION_LABEL[k]}
          </span>
        );
      })}
    </div>
  );
}
