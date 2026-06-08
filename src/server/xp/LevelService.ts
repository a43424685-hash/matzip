/**
 * LevelService — 레벨 계산 로직 (전체/지역 공통).
 *
 * 공식 (완화판):
 *   requiredXpForNextLevel(level) = 150 + floor(level ^ 1.5 * 40)
 *   - 만렙 Lv.200
 *   - 초반 빠르게(한두 곳 인증으로 레벨업), 후반은 랭킹 prestige로 남게
 *   - 참고: 1건 풀인증 ≈ 760 XP. Lv.10 ≈ 인증 12건, Lv.50 ≈ 567건, Lv.200 ≈ 18,000건+
 *
 * 누적 임계값(cumulative XP)을 1회 계산해 캐시한다.
 * cumulativeXp[L] = Lv.L 도달에 필요한 총 XP (Lv.1 = 0).
 */

export const MAX_LEVEL = 200;

/** Lv.level → Lv.level+1 로 가기 위해 필요한 XP */
export function requiredXpForNextLevel(level: number): number {
  if (level >= MAX_LEVEL) return Infinity;
  return 150 + Math.floor(Math.pow(level, 1.5) * 40);
}

// 누적 임계값 테이블 (index = level). cumulativeXp[1] = 0
const cumulativeXp: number[] = (() => {
  const arr = [0, 0]; // index 0 미사용, index 1 = Lv.1 = 0
  for (let level = 1; level < MAX_LEVEL; level++) {
    arr[level + 1] = arr[level] + requiredXpForNextLevel(level);
  }
  return arr;
})();

/** 특정 레벨 도달에 필요한 누적 XP */
export function cumulativeXpForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level > MAX_LEVEL) return cumulativeXp[MAX_LEVEL];
  return cumulativeXp[level];
}

export interface LevelProgress {
  level: number;
  totalXp: number;
  isMaxLevel: boolean;
  /** 현재 레벨 시작 누적 XP */
  currentLevelFloorXp: number;
  /** 다음 레벨 도달 누적 XP (만렙이면 현재와 동일) */
  nextLevelXp: number;
  /** 현재 레벨 구간에서 쌓은 XP */
  xpIntoLevel: number;
  /** 다음 레벨까지 남은 XP (만렙이면 0) */
  xpToNextLevel: number;
  /** 진행률 0~1 (만렙이면 1) */
  progress: number;
}

/** 누적 XP로부터 레벨 + 진행 정보 계산 */
export function calculateLevel(totalXp: number): LevelProgress {
  const xp = Math.max(0, Math.floor(totalXp));

  // 이진 탐색으로 가장 높은 도달 레벨 찾기
  let level = 1;
  for (let l = MAX_LEVEL; l >= 1; l--) {
    if (xp >= cumulativeXpForLevel(l)) {
      level = l;
      break;
    }
  }

  const isMaxLevel = level >= MAX_LEVEL;
  const currentLevelFloorXp = cumulativeXpForLevel(level);
  const nextLevelXp = isMaxLevel
    ? currentLevelFloorXp
    : cumulativeXpForLevel(level + 1);
  const span = nextLevelXp - currentLevelFloorXp;
  const xpIntoLevel = xp - currentLevelFloorXp;
  const xpToNextLevel = isMaxLevel ? 0 : nextLevelXp - xp;
  const progress = isMaxLevel || span <= 0 ? 1 : xpIntoLevel / span;

  return {
    level,
    totalXp: xp,
    isMaxLevel,
    currentLevelFloorXp,
    nextLevelXp,
    xpIntoLevel,
    xpToNextLevel,
    progress: Math.min(1, Math.max(0, progress)),
  };
}

/** XP 변화량을 레벨 진행률(%) 증가분으로 환산 (등록 완료 화면용) */
export function levelProgressDeltaPercent(beforeXp: number, afterXp: number): number {
  const before = calculateLevel(beforeXp);
  const after = calculateLevel(afterXp);
  // 단순화: 같은 레벨이면 진행률 차이, 레벨업했으면 합산 근사
  if (after.level === before.level) {
    return Math.round((after.progress - before.progress) * 100);
  }
  return Math.round((1 - before.progress + after.progress) * 100);
}
