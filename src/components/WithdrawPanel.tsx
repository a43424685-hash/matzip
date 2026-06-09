"use client";

import { Moon, UserX } from "lucide-react";
import { deactivateAction, deleteAccountAction } from "@/app/actions/account";

export default function WithdrawPanel() {
  return (
    <div className="mt-6 space-y-4">
      {/* 비활성화 */}
      <section className="rounded-2xl border border-stone-200 p-4">
        <h2 className="flex items-center gap-1.5 text-sm font-extrabold text-ink">
          <Moon size={16} className="text-forest" /> 잠시 쉬어가기 (비활성화)
        </h2>
        <p className="mt-1 text-[13px] text-ink-muted">
          내 글과 프로필이 다른 사람에게 안 보여요. 데이터는 그대로 보관되고,{" "}
          <b className="text-ink">다시 로그인하면 바로 복구</b>돼요.
        </p>
        <form action={deactivateAction}>
          <button
            type="submit"
            onClick={(e) => {
              if (!confirm("계정을 비활성화할까요? 다시 로그인하면 복구돼요.")) e.preventDefault();
            }}
            className="btn-outline mt-3 h-11 w-full !text-sm"
          >
            비활성화하기
          </button>
        </form>
      </section>

      {/* 완전 탈퇴 */}
      <section className="rounded-2xl border border-coral/40 bg-coral-soft/30 p-4">
        <h2 className="flex items-center gap-1.5 text-sm font-extrabold text-coral-dark">
          <UserX size={16} /> 회원 탈퇴 (완전 삭제)
        </h2>
        <p className="mt-1 text-[13px] text-ink-muted">
          계정과 내가 쓴 글·리뷰·저장·리스트가 <b className="text-coral-dark">영구 삭제</b>돼요. 되돌릴 수 없어요.
        </p>
        <form action={deleteAccountAction}>
          <button
            type="submit"
            onClick={(e) => {
              if (
                !confirm("정말 탈퇴할까요? 내 모든 기록이 영구 삭제되며 되돌릴 수 없어요.") ||
                !confirm("마지막 확인이에요. 탈퇴를 진행할까요?")
              ) {
                e.preventDefault();
              }
            }}
            className="mt-3 flex h-11 w-full items-center justify-center rounded-xl bg-coral text-sm font-bold text-white active:scale-[0.99]"
          >
            영구 탈퇴하기
          </button>
        </form>
      </section>
    </div>
  );
}
