"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, X, ExternalLink } from "lucide-react";
import { appConfirm, toast } from "@/components/AppDialogs";
import type { AbuseFlagRow } from "@/server/admin/AbuseFlagService";
import { abuseKindLabel } from "@/server/admin/AbuseFlagService";

function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return `${Math.floor(s / 86400)}일 전`;
}

export default function AdminAbuseFlags({ rows }: { rows: AbuseFlagRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function resolve(id: string, action: "reviewed" | "dismissed") {
    if (action === "dismissed") {
      const ok = await appConfirm({ title: "오탐으로 무시할까요?", body: "정상 활동으로 판단해 목록에서 제거해요.", confirmLabel: "무시" });
      if (!ok) return;
    }
    setBusy(id);
    try {
      const r = await fetch("/api/admin/abuse-flags/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      if (!r.ok) {
        toast("처리에 실패했어요.", "error");
        return;
      }
      router.refresh();
    } catch {
      toast("네트워크 오류로 처리하지 못했어요.", "error");
    } finally {
      setBusy(null);
    }
  }

  if (rows.length === 0) {
    return (
      <p className="mt-6 rounded-2xl bg-stone-50 py-10 text-center text-sm text-stone-400">
        검토할 의심 활동이 없어요. 👍
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {rows.map((r) => (
        <div key={r.id} className="card p-4">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[12px] font-bold text-amber-700">
              {abuseKindLabel(r.kind)}
            </span>
            {r.suspended && (
              <span className="rounded-md bg-coral/10 px-1.5 py-0.5 text-[11px] font-bold text-coral-dark">정지됨</span>
            )}
            <span className="ml-auto text-[12px] text-stone-400">{ago(r.createdAt)}</span>
          </div>

          <div className="mt-2 text-[13px] text-ink">
            <Link href={`/admin/members/${r.userId}`} className="font-bold text-forest underline">
              {r.nickname}
            </Link>
            <span className="text-ink-muted"> · {r.detail}</span>
          </div>

          <div className="mt-3 flex items-center gap-4">
            <Link
              href={`/admin/members/${r.userId}`}
              className="flex items-center gap-1 text-[13px] font-semibold text-forest"
            >
              <ExternalLink size={14} /> 회원 상세 (정지 처리)
            </Link>
            <button
              type="button"
              disabled={busy === r.id}
              onClick={() => resolve(r.id, "dismissed")}
              className="flex items-center gap-1 text-[13px] font-semibold text-stone-500 disabled:opacity-50"
            >
              <X size={14} /> 오탐 무시
            </button>
            <button
              type="button"
              disabled={busy === r.id}
              onClick={() => resolve(r.id, "reviewed")}
              className="ml-auto flex items-center gap-1 text-[13px] font-semibold text-stone-500 disabled:opacity-50"
            >
              <Check size={14} /> 검토완료
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
