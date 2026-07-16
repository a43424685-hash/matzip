import { RotateCcw } from "lucide-react";
import { listRecentPurchases } from "@/server/payment/PaymentService";
import AdminRefundButton from "@/components/admin/AdminRefundButton";

export const dynamic = "force-dynamic";

const won = (n: number) => n.toLocaleString();
function ymd(d: Date | string) {
  const x = new Date(d);
  return `${x.getFullYear()}.${String(x.getMonth() + 1).padStart(2, "0")}.${String(x.getDate()).padStart(2, "0")}`;
}
const STATUS: Record<string, { label: string; cls: string }> = {
  paid: { label: "결제완료", cls: "bg-forest-soft text-forest" },
  refunded: { label: "환불됨", cls: "bg-stone-100 text-stone-500" },
};

export default async function AdminRefundsPage() {
  const purchases = await listRecentPurchases(100);

  return (
    <div>
      <h1 className="flex items-center gap-2 text-xl font-black text-ink">
        <RotateCcw size={20} className="text-forest" /> 환불 관리
      </h1>
      <p className="mt-1 text-sm text-ink-muted">
        환불 처리하면 구매자 접근이 회수되고 판매자 정산에서 차감돼요. 실제 결제 환불(현금)은 App Store·Google Play에서 이뤄져요.
      </p>

      {purchases.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-stone-200 bg-white p-5 text-center text-sm text-stone-400">
          아직 결제 내역이 없어요.
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {purchases.map((p) => {
            const s = STATUS[p.status] ?? STATUS.paid;
            return (
              <div key={p.id} className="rounded-2xl border border-stone-200 bg-white p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-ink">{p.collection.title}</div>
                    <div className="mt-0.5 text-[12px] text-ink-muted">
                      구매자 {p.buyer.nickname} ({p.buyer.email})
                    </div>
                    <div className="text-[11px] text-stone-400">
                      판매자 {p.collection.user.nickname} · {ymd(p.paidAt)} · {won(p.amountWon)}원
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${s.cls}`}>{s.label}</span>
                    {p.status === "paid" && <AdminRefundButton purchaseId={p.id} amountWon={p.amountWon} />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
