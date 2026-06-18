import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * 공통 빈 화면 — 결과없음 / 준비중 / 로그인필요 등을 같은 모양으로.
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-forest-soft text-forest">
        <Icon size={26} />
      </span>
      <p className="text-[15px] font-extrabold text-ink">{title}</p>
      {description && <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
