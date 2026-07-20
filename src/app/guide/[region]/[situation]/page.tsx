import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, ShieldCheck, Sparkles, ChevronRight } from "lucide-react";
import CardImage from "@/components/CardImage";
import {
  getGuidePage,
  eligibleCombos,
  slugToRegion,
  slugToSituation,
  regionToSlug,
  situationToSlug,
} from "@/server/guide/GuideService";

// 콘텐츠가 늘면 새 조합은 요청 시 렌더(dynamicParams 기본 true) + 아래 revalidate로 갱신
export const revalidate = 3600; // 1시간마다 재생성 (새 맛집 반영)

type Params = { region: string; situation: string };

/** 빌드 시점의 3곳 이상 조합만 정적 생성 (사이트맵과 일치) */
export async function generateStaticParams(): Promise<Params[]> {
  const combos = await eligibleCombos();
  return combos.map((c) => ({ region: c.regionSlug, situation: c.situationSlug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { region, situation } = await params;
  const regionName = slugToRegion(region);
  const situationName = slugToSituation(situation);
  const data = await getGuidePage(regionName, situationName);
  if (!data) return { title: "맛집 가이드", robots: { index: false } };

  const title = `${data.regionName} ${data.situationName} 맛집 ${data.count}곳`;
  const description = `${data.regionName}에서 ${data.situationName}하기 좋은 맛집 ${data.count}곳. 방문 위치 인증 또는 먹고핀 운영자가 직접 고른 진짜 맛집 리스트.`;
  return {
    title,
    description,
    alternates: { canonical: `/guide/${region}/${situation}` },
    openGraph: { title: `${title} | 먹고핀`, description, type: "website" },
  };
}

export default async function GuidePage({ params }: { params: Promise<Params> }) {
  const { region, situation } = await params;
  const data = await getGuidePage(slugToRegion(region), slugToSituation(situation));
  if (!data) notFound();

  return (
    <main className="px-5 pb-16 pt-5">
      <nav className="mb-2 text-[12px] text-stone-400">
        <Link href="/guide" className="hover:text-forest">맛집 가이드</Link> · {data.regionName}
      </nav>
      <h1 className="text-2xl font-black text-ink">
        {data.regionName} {data.situationName} 맛집 <span className="text-forest">{data.count}곳</span>
      </h1>
      <p className="mt-2 text-[13.5px] leading-relaxed text-ink-muted">
        {data.regionName}에서 <b className="text-ink">{data.situationName}</b>하기 좋은 맛집을 모았어요. 아래 목록은{" "}
        <b className="text-ink">방문 위치 인증</b>을 받았거나 먹고핀 <b className="text-ink">운영자가 직접 고른</b> 곳이에요.
        각 가게를 눌러 메뉴·후기·위치를 확인하세요.
      </p>

      {/* 맛집 목록 — 실제 맥락(지역·상황·대표메뉴·한줄평) 포함, 얄팍한 이름 나열 방지 */}
      <ul className="mt-5 space-y-3">
        {data.cards.map((c, i) => (
          <li key={c.id}>
            <Link
              href={`/restaurants/${c.id}`}
              className="flex gap-3 rounded-2xl border border-stone-200 bg-white p-3.5 active:bg-stone-50"
            >
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-stone-100">
                {c.media ? (
                  <CardImage src={c.media.thumbnailUrl ?? c.media.url} alt={c.restaurantName} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl">🍽️</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-bold text-stone-400">{i + 1}</span>
                  <span className="truncate text-[15px] font-bold text-ink">{c.restaurantName}</span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="text-stone-400">📍 {c.regionName}</span>
                  {/* 정직한 라벨: 방문 인증 vs 운영자 추천 (혼동 금지) */}
                  {c.verification.location ? (
                    <span className="inline-flex items-center gap-0.5 rounded-md bg-forest-soft px-1.5 py-0.5 font-bold text-forest">
                      <ShieldCheck size={11} /> 방문 인증
                    </span>
                  ) : c.isOperatorPick ? (
                    <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-100 px-1.5 py-0.5 font-bold text-amber-700">
                      <Sparkles size={11} /> 운영자 추천
                    </span>
                  ) : null}
                  {c.signatureMenu && <span className="text-stone-500">· {c.signatureMenu}</span>}
                  {c.extRating && <span className="text-stone-500">· ⭐ {c.extRating}</span>}
                </div>
                {c.shortReview && (
                  <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-ink-muted">{c.shortReview}</p>
                )}
                {c.categories.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {c.categories.slice(0, 3).map((cat) => (
                      <span key={cat} className="rounded bg-stone-100 px-1.5 py-0.5 text-[10.5px] text-stone-500">
                        {cat}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {/* 내부 링크 — 같은 지역 다른 상황 (크롤링·SEO) */}
      {data.related.length > 0 && (
        <section className="mt-9">
          <h2 className="text-sm font-extrabold text-ink">{data.regionName}의 다른 맛집 가이드</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.related.map((r) => (
              <Link
                key={r.situationSlug}
                href={`/guide/${regionToSlug(data.regionName)}/${situationToSlug(r.situationName)}`}
                className="flex items-center gap-1 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-ink"
              >
                {r.situationName} <span className="text-stone-400">{r.count}</span>
                <ChevronRight size={13} className="text-stone-300" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="mt-8 rounded-2xl bg-stone-50 p-4 text-center">
        <p className="text-[13px] text-ink-muted">
          <MapPin size={14} className="mb-0.5 inline text-forest" /> 먹고핀은 <b className="text-ink">가본 사람이 위치 인증한</b> 진짜 맛집 앱이에요.
        </p>
        <Link href="/" className="mt-2 inline-block text-[13px] font-bold text-forest">
          먹고핀에서 더 보기 →
        </Link>
      </div>
    </main>
  );
}
