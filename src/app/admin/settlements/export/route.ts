import { getCurrentUser } from "@/lib/auth";
import { listWithdrawals, computePayout } from "@/server/payment/WithdrawalService";

export const dynamic = "force-dynamic";

function ymd(d: Date | string | null) {
  if (!d) return "";
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}
function esc(v: string | number) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return new Response("Forbidden", { status: 403 });

  const all = await listWithdrawals();
  const paid = all
    .filter((w) => w.status === "paid")
    .sort((a, b) => new Date(a.processedAt ?? 0).getTime() - new Date(b.processedAt ?? 0).getTime());

  const header = ["지급일", "아이디(이메일)", "예금주", "닉네임", "은행", "계좌번호", "정산액", "원천징수(3.3%)", "실지급액"];
  const rows = paid.map((w) => {
    const { withholdingWon, payoutWon } = computePayout(w.amountWon);
    return [
      ymd(w.processedAt),
      w.seller.email,
      w.accountHolder,
      w.seller.nickname,
      w.bankName,
      w.accountNumber,
      w.amountWon,
      withholdingWon,
      payoutWon,
    ];
  });

  // 합계 행
  const totalNet = paid.reduce((s, w) => s + w.amountWon, 0);
  const totalWh = paid.reduce((s, w) => s + computePayout(w.amountWon).withholdingWon, 0);
  rows.push(["합계", "", "", "", "", "", totalNet, totalWh, totalNet - totalWh]);

  const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
  const bom = "﻿"; // 엑셀 한글 깨짐 방지

  return new Response(bom + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mukgopin-settlements.csv"`,
    },
  });
}
