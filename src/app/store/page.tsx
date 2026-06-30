import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ShieldCheck, Coins } from "lucide-react";
import BackHomeHeader from "@/components/BackHomeHeader";
import StoreSearchBar from "@/components/StoreSearchBar";
import { StoreTile, StoreRow } from "@/components/StoreMapCard";
import {
  getStoreMaps,
  buildStoreSections,
  filterStoreMaps,
  STORE_THEMES,
  type StoreSort,
} from "@/server/store/StoreService";

export const metadata: Metadata = { title: "맛집 지도 · 먹고핀" };
export const dynamic = "force-dynamic";

const SORTS: { key: StoreSort; label: string }[] = [
  { key: "popular", label: "인기순" },
  { key: "recent", label: "최신순" },
  { key: "priceAsc", label: "가격 낮은순" },
  { key: "priceDesc", label: "가격 높은순" },
];

export default async function StorePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const q = str(sp.q);
  const theme = str(sp.theme);
  const region = str(sp.region);
  const sort = (str(sp.sort) || "popular") as StoreSort;
  const isSearchMode = !!(q || theme || region || sp.sort);

  const maps = await getStoreMaps();
  const regions = [...new Set(maps.map((m) => m.regionName))];

  return (
    <main className="min-h-[100dvh] pb-12">
      <BackHomeHeader title="맛집 지도" />
      <div className="px-5">
        <StoreSearchBar initial={q} />
      </div>

      {isSearchMode ? (
        <SearchResults maps={maps} q={q} theme={theme} region={region} sort={sort} />
      ) : (
        <Browse maps={maps} regions={regions} />
      )}
    </main>
  );
}

/* ── 둘러보기 (테마 큐레이션) ── */
function Browse({ maps, regions }: { maps: Awaited<ReturnType<typeof getStoreMaps>>; regions: string[] }) {
  if (maps.length === 0) {
    return (
      <p className="mx-5 mt-6 rounded-2xl bg-stone-50 p-5 text-center text-[13px] text-ink-muted">
        아직 판매 중인 맛집 지도가 없어요.
        <br />곧 검증된 미식가들의 지도가 올라올 예정이에요.
      </p>
    );
  }
  const sections = buildStoreSections(maps);

  return (
    <>
      {/* 지역으로 찾기 */}
      {regions.length > 0 && (
        <div className="mt-4">
          <p className="px-5 text-[13px] font-bold text-ink">📍 지역으로 찾기</p>
          <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto px-5">
            {regions.map((r) => (
              <Link
                key={r}
                href={`/store?region=${encodeURIComponent(r)}`}
                className="shrink-0 rounded-full border border-stone-200 bg-white px-3.5 py-2 text-[13px] font-semibold text-ink"
              >
                {r}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 테마 섹션들 (가로 스크롤) */}
      {sections.map((sec) => {
        const moreHref =
          sec.key === "hot"
            ? "/store?sort=popular"
            : sec.key === "new"
              ? "/store?sort=recent"
              : `/store?theme=${sec.key}`;
        return (
          <section key={sec.key} className="mt-6">
            <div className="flex items-end justify-between px-5">
              <h2 className="text-[15px] font-extrabold text-ink">
                {sec.emoji} {sec.title}
              </h2>
              <Link href={moreHref} className="flex items-center text-[13px] font-semibold text-forest">
                전체 <ChevronRight size={15} />
              </Link>
            </div>
            <div className="no-scrollbar mt-2.5 flex gap-3 overflow-x-auto px-5 pb-1">
              {sec.maps.map((m) => (
                <StoreTile key={m.id} map={m} />
              ))}
            </div>
          </section>
        );
      })}

      <StoreInfo />
    </>
  );
}

/* ── 검색결과 (필터 + 정렬 리스트) ── */
function SearchResults({
  maps,
  q,
  theme,
  region,
  sort,
}: {
  maps: Awaited<ReturnType<typeof getStoreMaps>>;
  q: string;
  theme: string;
  region: string;
  sort: StoreSort;
}) {
  const results = filterStoreMaps(maps, { q, theme, region, sort });
  const themeTitle = STORE_THEMES.find((t) => t.key === theme)?.title;
  const label = [q && `"${q}"`, region, themeTitle].filter(Boolean).join(" · ");

  // 정렬 링크용: 현재 필터 유지하면서 sort만 교체
  const base = new URLSearchParams();
  if (q) base.set("q", q);
  if (theme) base.set("theme", theme);
  if (region) base.set("region", region);
  const sortHref = (s: StoreSort) => {
    const p = new URLSearchParams(base);
    p.set("sort", s);
    return `/store?${p.toString()}`;
  };

  return (
    <div className="mt-3 px-5">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-ink-muted">
          {label && <b className="text-ink">{label}</b>} 지도 <b className="text-forest">{results.length}</b>개
        </p>
        <Link href="/store" className="text-[12px] font-semibold text-stone-400">
          ← 둘러보기
        </Link>
      </div>

      {/* 정렬 */}
      <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
        {SORTS.map((s) => (
          <Link
            key={s.key}
            href={sortHref(s.key)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold ${
              sort === s.key ? "bg-forest text-white" : "border border-stone-200 bg-white text-ink-muted"
            }`}
          >
            {s.label}
          </Link>
        ))}
      </div>

      {results.length === 0 ? (
        <p className="mt-6 rounded-2xl bg-stone-50 p-5 text-center text-[13px] text-ink-muted">
          조건에 맞는 맛집 지도가 없어요.
          <br />
          다른 지역·테마로 찾아보거나 검색어를 바꿔보세요.
        </p>
      ) : (
        <div className="mt-3 space-y-2.5">
          {results.map((m) => (
            <StoreRow key={m.id} map={m} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── 맨 아래: 유료 지도 안내 (접이식) ── */
function StoreInfo() {
  return (
    <details className="mx-5 mt-8 rounded-2xl border border-stone-200 bg-stone-50 p-4">
      <summary className="cursor-pointer list-none text-[13px] font-bold text-ink">
        유료 맛집 지도란? · 가격 · 환불 안내
      </summary>
      <div className="mt-3 space-y-2.5 text-[12.5px] leading-relaxed text-ink-muted">
        <p>
          검증된 미식가가 직접 발로 뛰며 인증한 맛집 목록을 모은 <b className="text-ink">디지털 콘텐츠 상품</b>이에요. 구매하면
          가게 이름·위치·후기·인증 정보 전체가 열려요.
        </p>
        <p className="flex items-start gap-1.5">
          <ShieldCheck size={14} className="mt-0.5 shrink-0 text-forest" /> 위치·메뉴 인증을 거친 맛집 위주로 구성됩니다.
        </p>
        <p className="flex items-start gap-1.5">
          <Coins size={14} className="mt-0.5 shrink-0 text-forest" /> 가격 990원 ~ 9,900원(부가세 포함). 결제는
          카카오페이·네이버페이 등 간편결제(PG)로 처리됩니다.
        </p>
        <p className="text-stone-400">
          본 상품은 디지털 콘텐츠로, 구매 즉시 콘텐츠 전체가 공개되며 공개 후에는 청약철회가 제한될 수 있습니다. 자세한 내용은{" "}
          <Link href="/refund" className="font-semibold text-forest underline">
            환불·취소정책
          </Link>
          을 확인해 주세요.
        </p>
      </div>
    </details>
  );
}
