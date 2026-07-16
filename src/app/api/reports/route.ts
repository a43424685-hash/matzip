import { NextResponse } from "next/server";
import { getActiveUserId } from "@/lib/auth";
import { createReport } from "@/server/report/ReportService";

export async function POST(req: Request) {
  const userId = await getActiveUserId();
  if (!userId) return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const r = await createReport({
    reporterId: userId,
    targetType: String(body.targetType ?? ""),
    targetId: String(body.targetId ?? ""),
    reason: String(body.reason ?? "etc"),
    detail: body.detail ? String(body.detail) : null,
  });

  if (!r.ok) {
    const status =
      r.reason === "DUPLICATE" ? 409 : r.reason === "NOT_FOUND" ? 404 : r.reason === "SELF" ? 403 : 400;
    return NextResponse.json(r, { status });
  }
  return NextResponse.json(r);
}
