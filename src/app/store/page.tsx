import type { Metadata } from "next";
import Link from "next/link";
import { Coins, MapPin, ChevronRight, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/db";
import LegalShell from "@/components/LegalShell";

export const metadata: Metadata = { title: "상품 안내 · 먹고핀" };
export const dynamic = "force-dynamic";

export default async function StorePage() {
  const onSale = await prisma.collection.findMany({
    where: { isPaid: true, isPublic: true },
    orderBy: { updatedAt: "desc" },
    take: 30,
    select: {
      id: true,
      title: true,
      priceWon: true,
      region: { select: { name: true } },
      user: { select: { nickname: true } },
      _count: { select: { items: true, purchases: true } },
    },
  });

  return (
    <LegalShell title="상품 안내">
      <div className="not-prose">
        <h2 className="flex items-center gap-1.5 text-lg font-black text-ink">
          <Coins size={20} className="text-forest" /> 유료 맛집 지도
        </h2>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-muted">
          검증된 미식가가 직접 발로 뛰며 인증한 맛집 목록을 모은 <b className="text-ink">디지털 콘텐츠 상품</b>이에요.
          구매하면 가게 이름·위치·후기·인증 정보 전체가 열려요.
        </p>

        {/* 가격 안내 (전자상거래법 — 가격 표시) */}
        <section className="mt-5 rounded-2xl border border-forest/20 bg-forest-soft/25 p-5">
          <h3 className="text-sm font-extrabold text-ink">판매 가격</h3>
          <p className="mt-1 text-[13px] text-ink-muted">
            상품(맛집 지도)별로 판매자가 아래 범위에서 가격을 정합니다.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[990, 2900, 9900].map((p, i) => (
              <div key={p} className="rounded-xl bg-white p-3 shadow-sm">
                <div className="text-[11px] font-semibold text-stone-400">
                  {i === 0 ? "최소" : i === 1 ? "보통" : "최대"}
                </div>
                <div className="mt-0.5 text-base font-black text-forest">{p.toLocaleString()}원</div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-stone-400">* 부가세 포함 / 가격 범위: 990원 ~ 9,900원</p>
        </section>

        <ul className="mt-4 space-y-1.5 text-[13px] text-ink-muted">
          <li className="flex items-start gap-1.5"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-forest" /> 위치·메뉴 인증을 거친 맛집 위주로 구성됩니다.</li>
          <li className="flex items-start gap-1.5"><Coins size={15} className="mt-0.5 shrink-0 text-forest" /> 결제는 카카오페이·네이버페이 등 간편결제(PG)로 처리됩니다.</li>
        </ul>

        {/* 현재 판매 중인 상품 */}
        <h3 className="mt-7 text-sm font-extrabold text-ink">현재 판매 중인 맛집 지도</h3>
        {onSale.length === 0 ? (
          <p className="mt-2 rounded-2xl bg-stone-50 p-4 text-[13px] text-ink-muted">
            아직 판매 중인 맛집 지도가 없어요. 곧 검증된 미식가들의 지도가 올라올 예정이에요.
          </p>
        ) : (
          <div className="mt-2 space-y-2">
            {onSale.map((c) => (
              <Link key={c.id} href={`/collections/${c.id}`} className="card flex items-center gap-3 p-3.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-ink">{c.title}</div>
                  <div className="mt-0.5 flex items-center gap-1 text-[12px] text-ink-muted">
                    <MapPin size={12} /> {c.region.name} · 맛집 {c._count.items}곳{c._count.purchases > 0 && ` · 구매 ${c._count.purchases}건`} · {c.user.nickname}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm font-black text-forest">{c.priceWon?.toLocaleString()}원</div>
                </div>
                <ChevronRight size={18} className="shrink-0 text-stone-300" />
              </Link>
            ))}
          </div>
        )}

        <p className="mt-6 text-[12px] leading-relaxed text-stone-400">
          본 상품은 디지털 콘텐츠로, 구매 즉시 콘텐츠 전체가 공개되며 공개 후에는 청약철회가 제한될 수 있습니다. 자세한 내용은{" "}
          <Link href="/refund" className="font-semibold text-forest underline">환불·취소정책</Link>을 확인해 주세요.
        </p>
      </div>
    </LegalShell>
  );
}
