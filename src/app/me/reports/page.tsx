import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { REPORT_REASON_LABEL } from "@/server/report/ReportService";
import MeSubPageHeader from "@/components/MeSubPageHeader";

export const dynamic = "force-dynamic";

function ago(d: Date): string {
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return `${Math.floor(s / 86400)}일 전`;
}

export default async function MyReportsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const reports = await prisma.report.findMany({
    where: { reporterId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, targetType: true, reason: true, status: true, createdAt: true },
  });

  return (
    <main className="px-5 pb-24 pt-5">
      <MeSubPageHeader title="신고 / 제재" />

      <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-[13px] leading-relaxed text-ink-muted">
        <p>허위 인증, 거짓 리뷰, 욕설, 광고성 글은 제한될 수 있어요.</p>
        <p className="mt-1">정직한 맛집 기록을 지키기 위한 운영 정책입니다.</p>
      </div>

      <h2 className="mb-2 mt-7 text-sm font-bold text-stone-400">내가 보낸 신고</h2>
      {reports.length === 0 ? (
        <p className="rounded-2xl bg-stone-50 py-10 text-center text-sm text-stone-400">
          보낸 신고가 없어요.
        </p>
      ) : (
        <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200/80">
          {reports.map((r) => (
            <li key={r.id} className="flex items-center gap-2 bg-white px-4 py-3">
              <span className="rounded-md bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-ink-muted">
                {r.targetType === "post" ? "글" : "댓글"}
              </span>
              <span className="text-sm text-ink">{REPORT_REASON_LABEL[r.reason] ?? r.reason}</span>
              <span className="ml-auto text-[11px] text-stone-400">{ago(r.createdAt)}</span>
              <span
                className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                  r.status === "resolved" ? "bg-forest-soft text-forest" : "bg-coral-soft text-coral-dark"
                }`}
              >
                {r.status === "resolved" ? "처리완료" : "접수됨"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
