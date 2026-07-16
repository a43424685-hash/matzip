"use client";

import { useState } from "react";
import { appConfirm, toast } from "@/components/AppDialogs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2, Check, ExternalLink } from "lucide-react";
import type { AdminReportRow } from "@/server/report/ReportService";

const REASON_LABEL: Record<string, string> = {
  spam: "스팸/광고",
  abuse: "욕설/비방",
  sexual: "음란물",
  illegal: "불법정보",
  wrong_info: "허위/잘못된 정보",
  etc: "기타",
};

function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return `${Math.floor(s / 86400)}일 전`;
}

export default function AdminReports({ rows }: { rows: AdminReportRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function resolve(id: string) {
    setBusy(id);
    await fetch("/api/admin/reports/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportId: id }),
    });
    setBusy(null);
    router.refresh();
  }

  async function del(row: AdminReportRow) {
    if (!row.deleteEndpoint) return;
    const ok = await appConfirm({
      title: "신고된 콘텐츠를 삭제할까요?",
      body: "되돌릴 수 없어요.",
      confirmLabel: "삭제",
      danger: true,
    });
    if (!ok) return;
    setBusy(row.id);
    try {
      const r = await fetch(row.deleteEndpoint, { method: "DELETE" });
      if (!r.ok) {
        toast("삭제에 실패했어요.", "error");
        return;
      }
      router.refresh();
    } catch {
      toast("네트워크 오류로 삭제하지 못했어요.", "error");
    } finally {
      setBusy(null);
    }
  }

  if (rows.length === 0) {
    return (
      <p className="mt-6 rounded-2xl bg-stone-50 py-10 text-center text-sm text-stone-400">
        처리할 신고가 없어요. 👍
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {rows.map((r) => (
        <div key={r.id} className="card p-4">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-coral-soft px-2 py-0.5 text-[12px] font-bold text-coral-dark">
              {REASON_LABEL[r.reason] ?? r.reason}
            </span>
            <span className="rounded-md bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-ink-muted">
              {r.targetType === "post"
                ? "글"
                : r.targetType === "comment"
                  ? "댓글"
                  : r.targetType === "community_post"
                    ? "커뮤니티 글"
                    : "커뮤니티 댓글"}
            </span>
            <span className="ml-auto text-[12px] text-stone-400">{ago(r.createdAt)}</span>
          </div>

          <div className="mt-2 text-[13px] text-ink-muted">
            신고자 <b className="text-ink">{r.reporterNickname}</b>
            {r.detail && <span className="text-stone-400"> · “{r.detail}”</span>}
          </div>

          <div className="mt-2 rounded-xl bg-stone-50 p-3">
            {r.targetExists ? (
              <>
                <div className="text-[13px] font-bold text-ink">
                  {r.targetLabel}
                  {r.targetAuthor && <span className="font-normal text-stone-400"> · {r.targetAuthor}</span>}
                </div>
                {r.targetSnippet && (
                  <p className="mt-0.5 line-clamp-3 text-[13px] text-ink-muted">{r.targetSnippet}</p>
                )}
              </>
            ) : (
              <p className="text-[13px] text-stone-400">(대상이 이미 삭제됨)</p>
            )}
          </div>

          <div className="mt-3 flex items-center gap-4">
            {r.href && r.targetExists && (
              <Link href={r.href} className="flex items-center gap-1 text-[13px] font-semibold text-forest">
                <ExternalLink size={14} /> 보기
              </Link>
            )}
            {r.targetExists && r.deleteEndpoint && (
              <button
                type="button"
                disabled={busy === r.id}
                onClick={() => del(r)}
                className="flex items-center gap-1 text-[13px] font-semibold text-coral-dark disabled:opacity-50"
              >
                <Trash2 size={14} /> 콘텐츠 삭제
              </button>
            )}
            <button
              type="button"
              disabled={busy === r.id}
              onClick={() => resolve(r.id)}
              className="ml-auto flex items-center gap-1 text-[13px] font-semibold text-stone-500 disabled:opacity-50"
            >
              <Check size={14} /> 처리완료
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
