"use client";

import { useEffect, useState } from "react";
import { MapPin, Trophy, Map as MapIcon } from "lucide-react";

const KEY = "mgp:onboarded:v1"; // 첫 방문 1회만

const STEPS = [
  { Icon: MapPin, title: "맛집에 가서 '위치 인증'하세요", desc: "진짜 가본 맛집만 올라와요. 가게 50m 안에서 자동 인증돼요." },
  { Icon: Trophy, title: "인증하면 XP가 쌓여요", desc: "기록하고 인증할수록 레벨이 오르고 내 동네 랭킹이 올라가요." },
  { Icon: MapIcon, title: "나만의 맛집 지도를 만드세요", desc: "모은 맛집을 지도로 공유하고, 유료 지도로 팔 수도 있어요." },
];

/**
 * 첫 방문 1회 환영 모달 — 앱 사용법 3가지 안내. 화면 가운데.
 * localStorage로 '평생 첫 1번만' 노출. 닫으면 날씨 토스트가 이어서 뜨도록 신호를 쏜다.
 */
export default function WelcomeOnboarding() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY)) return; // 이미 봤으면 다시 안 뜸
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
    // 날씨 토스트가 이어서 뜨도록 신호
    try {
      window.dispatchEvent(new Event("mgp:welcome-done"));
    } catch {
      /* ignore */
    }
  }

  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/45 px-6" onClick={close}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-fade-in w-full max-w-sm rounded-3xl bg-white px-6 pb-6 pt-7 shadow-2xl"
      >
        <div className="flex justify-center text-2xl font-black tracking-tight">
          <span className="text-ink">먹고</span>
          <span className="text-coral">핀</span>
        </div>
        <p className="mt-1 text-center text-sm font-semibold text-ink-muted">이렇게 하면 돼요</p>

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

        <button onClick={close} className="btn-primary mt-7 h-12 w-full !text-base">
          시작하기
        </button>
      </div>
    </div>
  );
}
