/**
 * StoreService — 유료 맛집 지도 "스토어"(둘러보기/검색) 데이터.
 *  - 테마 큐레이션(인기/데이트/노포·야장/가성비/최신) + 검색·필터·정렬.
 *  - 카드: 커버사진 + 지역 · 맛집수 · 구매수 + 만든이(닉네임·인증수).
 */
import { prisma } from "@/lib/db";
import { TIER_WONS } from "@/lib/iapTiers";

const mediaPick = { select: { type: true, url: true, thumbnailUrl: true }, orderBy: { sortOrder: "asc" as const }, take: 1 };

export interface StoreMapCard {
  id: string;
  title: string;
  price: number;
  regionName: string;
  itemCount: number;
  purchaseCount: number;
  creatorNickname: string;
  creatorVerifiedCount: number;
  creatorLevel: number;
  coverMedia: string | null;
  categories: string[]; // 담긴 맛집들의 대표 카테고리(중복 제거, 빈도순)
  updatedAt: Date;
}

/** 테마 섹션 정의 — 지도 제목(titleKeys) 우선, 없으면 담긴 맛집 카테고리(cats)로 분류 */
export const STORE_THEMES = [
  { key: "date", emoji: "💑", title: "데이트 코스", cats: ["데이트"], titleKeys: ["데이트"] },
  { key: "nopo", emoji: "🍻", title: "노포·야장", cats: ["노포", "야장"], titleKeys: ["노포", "야장", "포차", "포장마차"] },
  { key: "honbap", emoji: "🍜", title: "혼밥하기 좋은", cats: ["혼밥"], titleKeys: ["혼밥", "혼술"] },
  { key: "value", emoji: "💰", title: "가성비", cats: ["가성비"], titleKeys: ["가성비"] },
] as const;

/** 지도의 대표 테마 1개 (제목 키워드 우선 → 카테고리 빈도순). 없으면 null */
export function primaryThemeOf(m: { title: string; categories: string[] }): StoreThemeKey | null {
  for (const t of STORE_THEMES) {
    if (t.titleKeys.some((k) => m.title.includes(k))) return t.key;
  }
  for (const cat of m.categories) {
    const t = STORE_THEMES.find((x) => (x.cats as readonly string[]).includes(cat));
    if (t) return t.key;
  }
  return null;
}

export type StoreThemeKey = (typeof STORE_THEMES)[number]["key"];

/** 판매 중인 모든 유료 지도를 카드 형태로 */
export async function getStoreMaps(): Promise<StoreMapCard[]> {
  const cols = await prisma.collection.findMany({
    // 가격이 현행 IAP 티어가 아닌 지도(구 PG 시절 990원 등)는 구매가 불가능하므로 진열하지 않는다
    where: { isPaid: true, isPublic: true, priceWon: { in: [...TIER_WONS] } },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: {
      id: true,
      title: true,
      priceWon: true,
      updatedAt: true,
      region: { select: { name: true } },
      user: { select: { id: true, nickname: true, totalLevel: true } },
      _count: { select: { items: true, purchases: true } },
      items: {
        orderBy: { sortOrder: "asc" },
        take: 16,
        select: {
          post: {
            select: {
              media: mediaPick,
              categories: { select: { category: { select: { name: true } } } },
            },
          },
        },
      },
    },
  });

  // 만든이별 인증 맛집 수 (신뢰 뱃지) — 한 번에 배치 조회
  const creatorIds = [...new Set(cols.map((c) => c.user.id))];
  const verified =
    creatorIds.length > 0
      ? await prisma.restaurantPost.groupBy({
          by: ["userId"],
          where: { userId: { in: creatorIds }, locationVerified: true },
          _count: { _all: true },
        })
      : [];
  const vMap = new Map(verified.map((v) => [v.userId, v._count._all]));

  return cols.map((c) => {
    // 커버: 담긴 맛집 중 이미지 있는 첫 항목
    const cover = c.items.map((i) => i.post?.media[0]).find((m) => m && m.type === "image");
    // 카테고리 빈도순
    const freq = new Map<string, number>();
    for (const it of c.items) {
      for (const cat of it.post?.categories ?? []) {
        freq.set(cat.category.name, (freq.get(cat.category.name) ?? 0) + 1);
      }
    }
    const categories = [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
    return {
      id: c.id,
      title: c.title,
      price: c.priceWon ?? 0,
      regionName: c.region.name,
      itemCount: c._count.items,
      purchaseCount: c._count.purchases,
      creatorNickname: c.user.nickname,
      creatorVerifiedCount: vMap.get(c.user.id) ?? 0,
      creatorLevel: c.user.totalLevel,
      coverMedia: cover?.thumbnailUrl ?? cover?.url ?? null,
      categories,
      updatedAt: c.updatedAt,
    };
  });
}

/** 둘러보기(테마 큐레이션) — 섹션별로 묶어서 반환. 빈 섹션은 제외. */
export function buildStoreSections(maps: StoreMapCard[]) {
  const sections: { key: string; emoji: string; title: string; maps: StoreMapCard[] }[] = [];

  // 🔥 이번 주 인기 — 구매 많은 순 (구매 1건 이상 우선, 없으면 최신으로 채움)
  const popular = [...maps].sort((a, b) => b.purchaseCount - a.purchaseCount || +b.updatedAt - +a.updatedAt);
  if (popular.length > 0) sections.push({ key: "hot", emoji: "🔥", title: "이번 주 인기", maps: popular.slice(0, 12) });

  // 테마별 — 각 지도를 "대표 테마" 1개에만 배정해 중복 노출 방지 (제목 우선 → 카테고리)
  const buckets = new Map<string, StoreMapCard[]>();
  for (const m of maps) {
    const key = primaryThemeOf(m);
    if (key) {
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(m);
    }
  }
  for (const t of STORE_THEMES) {
    const inTheme = buckets.get(t.key) ?? [];
    if (inTheme.length > 0) sections.push({ key: t.key, emoji: t.emoji, title: t.title, maps: inTheme.slice(0, 12) });
  }

  // 🆕 새로 나온 지도 — 최신순
  const fresh = [...maps].sort((a, b) => +b.updatedAt - +a.updatedAt);
  if (fresh.length > 0) sections.push({ key: "new", emoji: "🆕", title: "새로 나온 지도", maps: fresh.slice(0, 12) });

  return sections;
}

export type StoreSort = "popular" | "recent" | "priceAsc" | "priceDesc";

/** 검색/필터/정렬 (검색결과 리스트 모드) */
export function filterStoreMaps(
  maps: StoreMapCard[],
  opts: { q?: string; theme?: string; region?: string; sort?: StoreSort }
): StoreMapCard[] {
  let out = maps;
  const q = opts.q?.trim().toLowerCase();
  if (q) {
    out = out.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.regionName.toLowerCase().includes(q) ||
        m.creatorNickname.toLowerCase().includes(q) ||
        m.categories.some((c) => c.toLowerCase().includes(q))
    );
  }
  if (opts.theme) {
    const t = STORE_THEMES.find((x) => x.key === opts.theme);
    if (t)
      out = out.filter(
        (m) =>
          t.titleKeys.some((k) => m.title.includes(k)) ||
          m.categories.some((c) => (t.cats as readonly string[]).includes(c))
      );
  }
  if (opts.region) out = out.filter((m) => m.regionName === opts.region);

  const sort = opts.sort ?? "popular";
  out = [...out].sort((a, b) => {
    if (sort === "recent") return +b.updatedAt - +a.updatedAt;
    if (sort === "priceAsc") return a.price - b.price;
    if (sort === "priceDesc") return b.price - a.price;
    return b.purchaseCount - a.purchaseCount || +b.updatedAt - +a.updatedAt; // popular
  });
  return out;
}
