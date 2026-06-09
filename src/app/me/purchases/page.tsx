import Link from "next/link";
import { redirect } from "next/navigation";
import { Coins, MapPin, ChevronRight } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getMyPurchases } from "@/server/payment/PaymentService";
import MeSubPageHeader from "@/components/MeSubPageHeader";

export const dynamic = "force-dynamic";

function fmtDate(d: Date | string) {
  const date = new Date(d);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

export default async function MyPurchasesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const purchases = await getMyPurchases(user.id);

  return (
    <main className="px-5 pb-24 pt-5">
      <MeSubPageHeader title={`구매한 지도 (${purchases.length})`} />

      {purchases.length === 0 ? (
        <p className="mt-10 rounded-2xl bg-stone-50 py-12 text-center text-sm text-stone-400">
          아직 구매한 맛집 지도가 없어요.
          <Link href="/store" className="mt-3 block font-semibold text-forest">
            맛집 지도 둘러보기 →
          </Link>
        </p>
      ) : (
        <div className="space-y-2.5">
          {purchases.map((p) => (
            <Link key={p.collectionId} href={`/collections/${p.collectionId}`} className="card flex items-center gap-3 p-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-forest-soft/40 text-forest">
                <Coins size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-ink">{p.title}</div>
                <div className="mt-0.5 flex items-center gap-1 text-[12px] text-ink-muted">
                  <MapPin size={12} /> {p.regionName} · 맛집 {p.itemCount}곳
                </div>
                <div className="mt-0.5 text-[11px] text-stone-400">
                  {fmtDate(p.paidAt)} 구매 · {p.amountWon.toLocaleString()}원
                </div>
              </div>
              <ChevronRight size={18} className="shrink-0 text-stone-300" />
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
