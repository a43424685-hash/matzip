"use client";

import { useEffect, useState } from "react";
import { VAPID_PUBLIC_KEY } from "@/lib/vapid";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-forest" : "bg-stone-300"}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${on ? "left-[22px]" : "left-0.5"}`}
      />
    </button>
  );
}

export default function NotificationSettings({
  initial,
}: {
  initial: { notifyLike: boolean; notifyComment: boolean };
}) {
  const [likes, setLikes] = useState(initial.notifyLike);
  const [comments, setComments] = useState(initial.notifyComment);
  const [saved, setSaved] = useState(false);

  const [pushSupported, setPushSupported] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMsg, setPushMsg] = useState("");

  useEffect(() => {
    const ok =
      typeof navigator !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setPushSupported(ok);
    if (!ok) return;
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => setPushOn(!!sub))
      .catch(() => {});
  }, []);

  async function enablePush() {
    setPushBusy(true);
    setPushMsg("");
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setPushMsg("알림 권한이 거부됐어요. 브라우저 설정에서 허용해 주세요.");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error("save fail");
      setPushOn(true);
      setPushMsg("폰 푸시 알림을 켰어요.");
    } catch {
      setPushMsg("푸시 알림을 켜지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setPushBusy(false);
      setTimeout(() => setPushMsg(""), 2500);
    }
  }

  async function disablePush() {
    setPushBusy(true);
    setPushMsg("");
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe().catch(() => {});
      }
      setPushOn(false);
    } finally {
      setPushBusy(false);
    }
  }

  async function save(next: { notifyLike: boolean; notifyComment: boolean }) {
    await fetch("/api/me/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    }).catch(() => {});
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="mt-4">
      <div className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200/80">
        <div className="flex items-center gap-3 bg-white px-4 py-3.5">
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold text-ink">좋아요 알림</div>
            <div className="text-[12px] text-stone-400">내 글이 좋아요를 받으면</div>
          </div>
          <Toggle
            on={likes}
            onClick={() => {
              const v = !likes;
              setLikes(v);
              void save({ notifyLike: v, notifyComment: comments });
            }}
          />
        </div>
        <div className="flex items-center gap-3 bg-white px-4 py-3.5">
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold text-ink">댓글·답글 알림</div>
            <div className="text-[12px] text-stone-400">내 글·댓글에 댓글/답글이 달리면</div>
          </div>
          <Toggle
            on={comments}
            onClick={() => {
              const v = !comments;
              setComments(v);
              void save({ notifyLike: likes, notifyComment: v });
            }}
          />
        </div>
      </div>
      <p className="mt-2 h-4 text-[12px] text-forest">{saved ? "저장됐어요." : ""}</p>

      {/* 폰 푸시 알림 (웹푸시) */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-stone-200/80">
        <div className="flex items-center gap-3 bg-white px-4 py-3.5">
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold text-ink">폰 푸시 알림</div>
            <div className="text-[12px] text-stone-400">
              앱을 안 보고 있어도 폰 화면에 알림이 떠요
            </div>
          </div>
          {pushSupported ? (
            <Toggle
              on={pushOn}
              onClick={() => {
                if (pushBusy) return;
                if (pushOn) void disablePush();
                else void enablePush();
              }}
            />
          ) : (
            <span className="shrink-0 text-[11px] text-stone-400">미지원 기기</span>
          )}
        </div>
      </div>
      <p className="mt-2 h-4 text-[12px] text-forest">{pushMsg}</p>
      <p className="mt-1 text-[12px] text-stone-400">
        ※ 아이폰은 홈 화면에 앱을 추가(설치)한 뒤에야 폰 푸시 알림을 받을 수 있어요.
      </p>
    </div>
  );
}
