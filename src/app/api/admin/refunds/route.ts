import { NextResponse } from "next/server";
import { getSessionAdmin } from "@/lib/auth";
import { can } from "@/server/admin/permissions";
import { refundPurchase } from "@/server/payment/PaymentService";

const MESSAGE: Record<string, string> = {
  NOT_FOUND: "결제 내역을 찾을 수 없어요.",
  NOT_REFUNDABLE: "이미 환불됐거나 환불할 수 없는 결제예요.",
  NO_PAYMENT_ID: "결제 식별자가 없어 취소할 수 없어요.",
  PG_CANCEL_FAILED: "포트원 결제 취소에 실패했어요. 잠시 후 다시 시도해 주세요.",
};

export async function POST(req: Request) {
  const admin = await getSessionAdmin();
  if (!admin?.isAdmin || !can(admin.role, "refund"))
    return NextResponse.json({ ok: false, reason: "FORBIDDEN" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const r = await refundPurchase(String(body.purchaseId ?? ""));
  if (!r.ok) {
    return NextResponse.json({ ok: false, reason: r.reason, message: MESSAGE[r.reason ?? ""] ?? "환불에 실패했어요." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
