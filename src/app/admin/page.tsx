import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { listReports } from "@/server/report/ReportService";
import AdminReports from "@/components/AdminReports";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/");

  const rows = await listReports("open");

  return (
    <main className="px-5 py-6">
      <h1 className="flex items-center gap-2 text-xl font-extrabold text-ink">
        <ShieldAlert size={20} className="text-coral" /> 신고함
      </h1>
      <p className="mt-1 text-sm text-ink-muted">
        미처리 신고 {rows.length}건 · 콘텐츠를 삭제하거나 처리완료로 넘기세요.
      </p>
      <AdminReports rows={rows} />
    </main>
  );
}
