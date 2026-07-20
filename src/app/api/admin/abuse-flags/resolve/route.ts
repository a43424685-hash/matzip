import { NextResponse } from "next/server";
import { getSessionAdmin } from "@/lib/auth";
import { can } from "@/server/admin/permissions";
import { resolveAbuseFlag } from "@/server/admin/AbuseFlagService";

// 어뷰징 의심 플래그 처리 (검토완료/무시) — report 권한 재사용
export async function POST(req: Request) {
  const me = await getSessionAdmin();
  if (!me || !me.isAdmin || !can(me.role, "report")) {
    return NextResponse.json({ ok: false, reason: "FORBIDDEN" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? "");
  const action = body.action === "dismissed" ? "dismissed" : "reviewed";
  if (!id) return NextResponse.json({ ok: false, reason: "BAD_REQUEST" }, { status: 400 });
  await resolveAbuseFlag(id, action);
  return NextResponse.json({ ok: true });
}
