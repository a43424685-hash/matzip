import { NextResponse } from "next/server";
import { getSessionAdmin } from "@/lib/auth";
import { can } from "@/server/admin/permissions";
import { processWithdrawal } from "@/server/payment/WithdrawalService";

export async function POST(req: Request) {
  const admin = await getSessionAdmin();
  if (!admin?.isAdmin || !can(admin.role, "settlement"))
    return NextResponse.json({ ok: false, reason: "FORBIDDEN" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const action = body.action === "paid" ? "paid" : body.action === "reject" ? "reject" : null;
  if (!action) return NextResponse.json({ ok: false, reason: "BAD_ACTION" }, { status: 400 });
  const r = await processWithdrawal(String(body.id ?? ""), action, body.memo);
  if (!r.ok) return NextResponse.json({ ok: false, reason: r.reason }, { status: 400 });
  return NextResponse.json({ ok: true });
}
