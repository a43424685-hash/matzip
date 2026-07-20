import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { listAbuseFlags } from "@/server/admin/AbuseFlagService";
import AdminAbuseFlags from "@/components/admin/AdminAbuseFlags";

export const dynamic = "force-dynamic";

export default async function AdminAbuseFlagsPage() {
  const rows = await listAbuseFlags("open");

  return (
    <div>
      <h1 className="flex items-center gap-2 text-xl font-black text-ink">
        <AlertTriangle size={20} className="text-amber-500" /> 어뷰징 의심
      </h1>
      <p className="mt-1 text-sm text-ink-muted">
        시스템이 자동 탐지한 의심 활동 {rows.length}건 · 검토 후 회원을 정지하거나 오탐이면 무시하세요.
      </p>
      <p className="mt-1 text-[12px] text-stone-400">
        예: 짧은 시간에 위치 인증이 과도하게 많으면(가짜 좌표로 판매자격 어뷰징 의심) 자동 보고돼요. 차단이 아니라 보고이니, 먹자골목 등 정상 케이스는 무시하면 됩니다.
      </p>
      <AdminAbuseFlags rows={rows} />
      <Link href="/admin" className="mt-6 inline-block text-[13px] font-semibold text-forest">
        ← 관리자 홈
      </Link>
    </div>
  );
}
