"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, AlertTriangle, Info } from "lucide-react";

/**
 * 전역 토스트 + 확인 모달 — window.alert/confirm 대체.
 * (네이티브 앱에서 OS 다이얼로그에 도메인이 노출되는 문제 + 디자인 일관성)
 *
 * 사용법(어느 클라이언트 컴포넌트에서든):
 *   import { toast, appConfirm } from "@/components/AppDialogs";
 *   toast("차단했어요");
 *   if (await appConfirm({ title: "글을 삭제할까요?", confirmLabel: "삭제", danger: true })) { ... }
 */

type ToastKind = "success" | "error" | "info";
interface ToastDetail {
  message: string;
  kind: ToastKind;
}

export function toast(message: string, kind: ToastKind = "info") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ToastDetail>("mgp:toast", { detail: { message, kind } }));
}

export interface ConfirmOptions {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface ConfirmDetail extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

export function appConfirm(opts: ConfirmOptions): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  return new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent<ConfirmDetail>("mgp:confirm", { detail: { ...opts, resolve } }));
  });
}

type ToastItem = ToastDetail & { id: number };

const TOAST_ICON: Record<ToastKind, typeof Info> = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
};

export default function AppDialogs() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmDetail | null>(null);
  const idRef = useRef(0);

  useEffect(() => {
    const onToast = (e: Event) => {
      const detail = (e as CustomEvent<ToastDetail>).detail;
      if (!detail?.message) return;
      const id = ++idRef.current;
      setToasts((list) => [...list.slice(-2), { ...detail, id }]);
      setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 3000);
    };
    const onConfirm = (e: Event) => {
      const detail = (e as CustomEvent<ConfirmDetail>).detail;
      if (!detail?.title) return;
      setConfirmState((prev) => {
        // 이미 떠 있는 확인창이 있으면 새 요청은 취소 처리 (중첩 방지)
        if (prev) {
          detail.resolve(false);
          return prev;
        }
        return detail;
      });
    };
    window.addEventListener("mgp:toast", onToast);
    window.addEventListener("mgp:confirm", onConfirm);
    return () => {
      window.removeEventListener("mgp:toast", onToast);
      window.removeEventListener("mgp:confirm", onConfirm);
    };
  }, []);

  const closeConfirm = useCallback(
    (ok: boolean) => {
      confirmState?.resolve(ok);
      setConfirmState(null);
    },
    [confirmState]
  );

  return (
    <>
      {/* 토스트 스택 — 하단 내비 위 */}
      {toasts.length > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-[95] flex flex-col items-center gap-2 px-5">
          {toasts.map((t) => {
            const Icon = TOAST_ICON[t.kind];
            return (
              <div
                key={t.id}
                className="flex max-w-md items-center gap-2 rounded-xl bg-ink/90 px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg"
              >
                <Icon
                  size={15}
                  className={t.kind === "success" ? "text-emerald-300" : t.kind === "error" ? "text-red-300" : "text-stone-300"}
                />
                {t.message}
              </div>
            );
          })}
        </div>
      )}

      {/* 확인 모달 */}
      {confirmState && (
        <div className="fixed inset-0 z-[96] flex items-center justify-center px-8" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="닫기"
            className="absolute inset-0 bg-black/40"
            onClick={() => closeConfirm(false)}
          />
          <div className="relative w-full max-w-xs rounded-2xl bg-white p-5 shadow-xl">
            <p className="text-[15px] font-extrabold text-ink">{confirmState.title}</p>
            {confirmState.body && (
              <p className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-ink-muted">{confirmState.body}</p>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" className="btn-outline h-11 !text-sm" onClick={() => closeConfirm(false)}>
                {confirmState.cancelLabel ?? "취소"}
              </button>
              <button
                type="button"
                className={`h-11 rounded-xl text-sm font-extrabold text-white ${confirmState.danger ? "bg-red-500 active:bg-red-600" : "bg-forest active:bg-forest/90"}`}
                onClick={() => closeConfirm(true)}
              >
                {confirmState.confirmLabel ?? "확인"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
