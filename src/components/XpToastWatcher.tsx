"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Sparkles, PartyPopper } from "lucide-react";

const SOURCE_LABEL: Record<string, string> = {
  post_created: "맛집 기록",
  photo_added: "사진",
  video_added: "영상",
  short_review: "한줄평",
  detail_review: "리뷰",
  categories: "카테고리",
  price: "가격 정보",
  waiting: "웨이팅 정보",
  revisit: "재방문 정보",
  menu_recommend: "추천 메뉴",
  location_verified: "위치 인증",
  receipt_verified: "영수증 인증",
  menu_verified: "메뉴판 인증",
  full_verify_bonus: "풀인증 보너스",
  like_received: "좋아요 받음",
  saved_by_user: "저장됨",
  shared: "공유됨",
  comment_received: "댓글 받음",
  video_views: "영상 조회",
  daily_first_verify: "오늘 첫 인증",
  region_5_verified: "지역 5곳 인증",
  region_10_verified: "지역 10곳 인증",
  streak_7d: "7일 연속",
  clean_30d: "클린 30일",
};

type Toast = { id: number; kind: "xp" | "level"; text: string; sub?: string };

/**
 * 전역 XP 토스트 — 경험치가 쌓이면 "+N XP", 레벨이 오르면 "🎉 Lv.N 달성".
 * /api/me/xp-flash 를 폴링해 마지막 본 시점 이후의 XpEvent/레벨을 비교한다.
 * 트리거: 페이지 이동 · 창 포커스 · 탭 복귀 · 커스텀 이벤트("mgp:xp", 인증 직후 발사).
 */
export default function XpToastWatcher() {
  const pathname = usePathname();
  const cursorRef = useRef<number>(0);
  const levelRef = useRef<number | null>(null);
  const readyRef = useRef(false);
  const guestRef = useRef(false);
  const lastFetchRef = useRef(0);
  const idRef = useRef(0);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = useCallback((t: Omit<Toast, "id">) => {
    const id = ++idRef.current;
    setToasts((list) => [...list, { ...t, id }]);
    const ttl = t.kind === "level" ? 4200 : 3000;
    setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), ttl);
  }, []);

  const check = useCallback(async () => {
    if (guestRef.current) return;
    const now = Date.now();
    if (now - lastFetchRef.current < 1200) return; // 과도한 호출 방지
    lastFetchRef.current = now;
    let data: { cursor: number; level: number | null; events: { amount: number; source: string; at: number }[] };
    try {
      const res = await fetch(`/api/me/xp-flash?since=${cursorRef.current}`, { cache: "no-store" });
      if (!res.ok) return;
      data = await res.json();
    } catch {
      return;
    }
    if (data.level == null) {
      guestRef.current = true; // 비로그인 → 더 안 부름
      return;
    }
    // 첫 호출은 기준선만 잡고 토스트 없음 (과거 XP 쏟아내기 방지)
    if (!readyRef.current) {
      cursorRef.current = data.cursor;
      levelRef.current = data.level;
      readyRef.current = true;
      return;
    }
    if (data.events.length > 0) {
      const total = data.events.reduce((s, e) => s + e.amount, 0);
      const label = SOURCE_LABEL[data.events[data.events.length - 1].source] ?? "활동 보상";
      if (total > 0) pushToast({ kind: "xp", text: `+${total} XP`, sub: label });
    }
    if (levelRef.current != null && data.level > levelRef.current) {
      pushToast({ kind: "level", text: `🎉 Lv.${data.level} 달성!`, sub: "축하해요, 레벨이 올랐어요" });
    }
    levelRef.current = data.level;
    cursorRef.current = data.cursor;
  }, [pushToast]);

  // 페이지 이동 시
  useEffect(() => {
    check();
  }, [pathname, check]);

  // 창 포커스 · 탭 복귀 · 인증 직후 커스텀 이벤트
  useEffect(() => {
    const onFocus = () => check();
    const onVis = () => {
      if (document.visibilityState === "visible") check();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("mgp:xp", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("mgp:xp", onFocus);
    };
  }, [check]);

  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[90] flex flex-col items-center gap-2 px-5">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`animate-fade-in flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-white shadow-lg ${
            t.kind === "level" ? "bg-coral" : "bg-forest"
          }`}
        >
          {t.kind === "level" ? <PartyPopper size={18} /> : <Sparkles size={16} />}
          <span>{t.text}</span>
          {t.sub && <span className="font-medium text-white/80">· {t.sub}</span>}
        </div>
      ))}
    </div>
  );
}
