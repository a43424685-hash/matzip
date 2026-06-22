"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, Trophy, Map as MapIcon } from "lucide-react";

const KEY = "mgp:onboarded:v1";

const STEPS = [
  { Icon: MapPin, title: "가서 '위치 인증'", desc: "진짜 가본 맛집만 올라와요. 가게 50m 안에서 자동 인증." },
  { Icon: Trophy, title: "인증할수록 XP·레벨업", desc: "기록하고 인증하면 경험치가 쌓이고 내 동네 랭킹이 올라가요." },
  { Icon: MapIcon, title: "나만의 맛집 지도", desc: "모은 맛집을 지도로 공유하고, 유료 지도로 팔 수도 있어요." },
];

/**
 * 첫 방문 1회 환영 시트 — 앱을 한눈에 이해시키는 3단계.
 * localStorage로 한 번만 노출.
 */
export default function WelcomeOnboarding({ loggedIn }: { loggedIn: boolean }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY)) return;
    } catch {
      return;
    }
    const t = setTimeout(() => setShow(true), 400);
    return () => clearTimeout(t);
  }, []);

  function close() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    setShow(false);
  }

  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/40" onClick={close}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-fade-in w-full max-w-md rounded-t-3xl bg-white px-6 pb-8 pt-7"
      >
        <div className="flex justify-center text-2xl font-black tracking-tight">
          <span className="text-ink">먹고</span>
          <span className="text-coral">핀</span>
        </div>
        <p className="mt-1 text-center text-sm font-semibold text-ink-muted">
          진짜 가본 맛집만, 먹고핀
        </p>

        <div className="mt-6 space-y-4">
          {STEPS.map(({ Icon, title, desc }) => (
            <div key={title} className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forest-soft text-forest">
                <Icon size={20} />
              </div>
              <div className="flex-1">
                <div className="text-[15px] font-bold text-ink">{title}</div>
                <div className="mt-0.5 text-[13px] leading-snug text-ink-muted">{desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-7 space-y-2">
          {loggedIn ? (
            <button onClick={close} className="btn-primary h-12 w-full !text-base">
              둘러보기 시작
            </button>
          ) : (
            <>
              <Link href="/signup" onClick={close} className="btn-primary h-12 w-full !text-base">
                가입하고 시작하기
              </Link>
              <button onClick={close} className="h-11 w-full text-sm font-semibold text-ink-muted">
                그냥 둘러볼게요
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
