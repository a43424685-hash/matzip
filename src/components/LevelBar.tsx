import { calculateLevel } from "@/server/xp/LevelService";

/** 현재 레벨 + 다음 레벨까지 진행바 (전체/지역 공통) */
export default function LevelBar({
  xp,
  label,
  compact = false,
}: {
  xp: number;
  label: string;
  compact?: boolean;
}) {
  const p = calculateLevel(xp);
  return (
    <div className={compact ? "" : "card p-4"}>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold text-ink">{label}</span>
        <span className="badge-lv">Lv.{p.level}</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-stone-100">
        <div
          className="h-full rounded-full bg-forest transition-all"
          style={{ width: `${Math.round(p.progress * 100)}%` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-stone-400">
        <span className="tabular-nums">{p.totalXp.toLocaleString()} XP</span>
        <span>
          {p.isMaxLevel
            ? "만렙 달성"
            : `다음 레벨까지 ${p.xpToNextLevel.toLocaleString()} XP`}
        </span>
      </div>
    </div>
  );
}
