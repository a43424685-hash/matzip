import { ShieldAlert } from "lucide-react";
import { listReports } from "@/server/report/ReportService";
import AdminReports from "@/components/AdminReports";

export const dynamic = "force-dynamic";

export default async function AdminReportsPage() {
  const rows = await listReports("open");

  return (
    <div>
      <h1 className="flex items-center gap-2 text-xl font-black text-ink">
        <ShieldAlert size={20} className="text-coral" /> 신고 · 문의
      </h1>
      <p className="mt-1 text-sm text-ink-muted">
        미처리 신고 {rows.length}건 · 콘텐츠를 삭제하거나 처리완료로 넘기세요.
      </p>
      <AdminReports rows={rows} />
    </div>
  );
}
