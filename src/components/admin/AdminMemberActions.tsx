"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import { Ban, RotateCcw, StickyNote } from "lucide-react";
import {
  suspendMemberAction,
  unsuspendMemberAction,
  memoMemberAction,
  type MemberActionState,
} from "@/app/actions/admin-member";

type Mode = null | "suspend" | "unsuspend" | "memo";

export default function AdminMemberActions({
  userId,
  suspended,
  isTargetAdmin,
}: {
  userId: string;
  suspended: boolean;
  isTargetAdmin: boolean;
}) {
  const [mode, setMode] = useState<Mode>(null);

  return (
    <section className="mt-6">
      <h2 className="mb-2 text-sm font-extrabold text-ink">운영자 조치</h2>
      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-[13px] text-stone-400">상태</span>
          {suspended ? (
            <span className="rounded-md bg-coral/10 px-2 py-0.5 text-[12px] font-bold text-coral-dark">정지됨</span>
          ) : (
            <span className="rounded-md bg-forest-soft px-2 py-0.5 text-[12px] font-bold text-forest">정상</span>
          )}
        </div>

        {isTargetAdmin ? (
          <p className="text-[13px] text-stone-400">운영자 계정은 정지할 수 없어요. 메모만 가능합니다.</p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {!suspended && !isTargetAdmin && (
            <ToggleBtn active={mode === "suspend"} onClick={() => setMode(mode === "suspend" ? null : "suspend")} danger>
              <Ban size={15} /> 계정 정지
            </ToggleBtn>
          )}
          {suspended && (
            <ToggleBtn active={mode === "unsuspend"} onClick={() => setMode(mode === "unsuspend" ? null : "unsuspend")}>
              <RotateCcw size={15} /> 정지 해제
            </ToggleBtn>
          )}
          <ToggleBtn active={mode === "memo"} onClick={() => setMode(mode === "memo" ? null : "memo")}>
            <StickyNote size={15} /> 메모
          </ToggleBtn>
        </div>

        {mode === "suspend" && (
          <ActionForm
            key="suspend"
            action={suspendMemberAction}
            userId={userId}
            requireReason
            placeholder="정지 사유 (사용자에게 표시돼요)"
            submitLabel="정지하기"
            danger
            onDone={() => setMode(null)}
          />
        )}
        {mode === "unsuspend" && (
          <ActionForm
            key="unsuspend"
            action={unsuspendMemberAction}
            userId={userId}
            placeholder="해제 사유 (선택, 로그에만 기록)"
            submitLabel="정지 해제"
            onDone={() => setMode(null)}
          />
        )}
        {mode === "memo" && (
          <ActionForm
            key="memo"
            action={memoMemberAction}
            userId={userId}
            requireReason
            placeholder="관리자 메모 (감사로그에 기록)"
            submitLabel="메모 남기기"
            onDone={() => setMode(null)}
          />
        )}
      </div>
    </section>
  );
}

function ToggleBtn({
  children,
  active,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-bold ${
        active
          ? danger
            ? "bg-coral text-white"
            : "bg-ink text-white"
          : danger
            ? "bg-coral/10 text-coral-dark"
            : "bg-stone-100 text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function ActionForm({
  action,
  userId,
  requireReason,
  placeholder,
  submitLabel,
  danger,
  onDone,
}: {
  action: (prev: MemberActionState, fd: FormData) => Promise<MemberActionState>;
  userId: string;
  requireReason?: boolean;
  placeholder: string;
  submitLabel: string;
  danger?: boolean;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<MemberActionState, FormData>(action, undefined);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={formAction} className="mt-3 space-y-2">
      <input type="hidden" name="userId" value={userId} />
      <textarea
        name="reason"
        required={requireReason}
        rows={2}
        placeholder={placeholder}
        className="w-full rounded-xl border border-stone-200 p-2.5 text-[13px] outline-none focus:border-forest"
      />
      {state?.error && <p className="text-[12px] text-coral-dark">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className={`w-full rounded-xl py-2.5 text-[13px] font-bold text-white disabled:opacity-50 ${
          danger ? "bg-coral" : "bg-forest"
        }`}
      >
        {pending ? "처리 중…" : submitLabel}
      </button>
    </form>
  );
}
