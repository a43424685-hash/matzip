import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, ChevronRight } from "lucide-react";
import { eligibleCombos } from "@/server/guide/GuideService";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "지역·상황별 맛집 가이드",
  description: "지역과 상황(데이트·혼밥·노포·회식 등)으로 찾는 맛집 가이드. 방문 인증 또는 먹고핀 운영자가 고른 진짜 맛집.",
  alternates: { canonical: "/guide" },
};

export default async function GuideIndexPage() {
  const combos = await eligibleCombos();

  // 지역별로 묶기
  const byRegion = new Map<string, typeof combos>();
  for (const c of combos) {
    const arr = byRegion.get(c.regionName) ?? [];
    arr.push(c);
    byRegion.set(c.regionName, arr);
  }

  return (
    <main className="px-5 pb-16 pt-5">
      <h1 className="text-2xl font-black text-ink">맛집 가이드</h1>
      <p className="mt-2 text-[13.5px] leading-relaxed text-ink-muted">
        지역과 상황으로 찾는 맛집 모음이에요. 방문 위치 인증을 받았거나 먹고핀 운영자가 직접 고른 진짜 맛집만 담았어요.
      </p>

      {combos.length === 0 ? (
        <p className="mt-8 rounded-2xl bg-stone-50 p-6 text-center text-sm text-ink-muted">
          아직 준비된 가이드가 없어요. 맛집이 쌓이면 지역·상황별 가이드가 자동으로 생겨요.
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          {[...byRegion.entries()].map(([regionName, list]) => (
            <section key={regionName}>
              <h2 className="flex items-center gap-1 text-sm font-extrabold text-ink">
                <MapPin size={15} className="text-forest" /> {regionName}
              </h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {list.map((c) => (
                  <Link
                    key={c.situationSlug}
                    href={`/guide/${c.regionSlug}/${c.situationSlug}`}
                    className="flex items-center gap-1 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-ink"
                  >
                    {c.situationName} <span className="text-stone-400">{c.count}</span>
                    <ChevronRight size={13} className="text-stone-300" />
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
