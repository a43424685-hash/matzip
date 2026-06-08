import { NextResponse } from "next/server";
import { getSessionAdmin } from "@/lib/auth";
import { resolveReport } from "@/server/report/ReportService";

// 신고 처리 완료 — 운영자만
export async function POST(req: Request) {
  const me = await getSessionAdmin();
  if (!me || !me.isAdmin) {
    return NextResponse.json({ ok: false, reason: "FORBIDDEN" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const reportId = String(body.reportId ?? "");
  if (!reportId) return NextResponse.json({ ok: false, reason: "BAD_REQUEST" }, { status: 400 });
  await resolveReport(reportId);
  return NextResponse.json({ ok: true });
}
