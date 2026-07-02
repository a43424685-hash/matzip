"use client";

import { useRouter } from "next/navigation";

/**
 * 홈 상단 [추천 | 팔로잉] 토글.
 * 선택을 쿠키(home_tab)에 저장 → 다음에 홈을 열면 마지막 선택이 유지됨
 * (X가 매번 추천으로 리셋해 욕먹은 실수를 피함).
 */
export default function HomeFeedToggle({ active }: { active: "recommend" | "following" }) {
  const router = useRouter();

  function select(tab: "recommend" | "following") {
    if (tab === active) return;
    // 1년짜리 쿠키로 마지막 선택 기억
    document.cookie = `home_tab=${tab}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    router.push(`/?tab=${tab}`);
  }

  return (
    <div className="mt-4 grid grid-cols-2 rounded-full bg-stone-100 p-1 text-[14px] font-bold">
      <button
        type="button"
        onClick={() => select("recommend")}
        className={`rounded-full py-2 ${active === "recommend" ? "bg-white text-ink shadow-sm" : "text-stone-400"}`}
      >
        추천
      </button>
      <button
        type="button"
        onClick={() => select("following")}
        className={`rounded-full py-2 ${active === "following" ? "bg-white text-ink shadow-sm" : "text-stone-400"}`}
      >
        팔로잉
      </button>
    </div>
  );
}
