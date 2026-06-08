/** 지역/카테고리 등 참조 데이터 조회 */
import { prisma } from "@/lib/db";

export async function getActiveRegions() {
  return prisma.region.findMany({
    where: { isActive: true, type: "province" },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });
}

export async function getActiveCategories() {
  return prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ type: "asc" }, { sortOrder: "asc" }],
    select: { id: true, name: true, type: true },
  });
}

export function groupCategoriesByType<T extends { type: string }>(cats: T[]) {
  const order = ["situation", "season", "credential", "food", "price"];
  const map = new Map<string, T[]>();
  for (const c of cats) {
    if (!map.has(c.type)) map.set(c.type, []);
    map.get(c.type)!.push(c);
  }
  return order
    .filter((t) => map.has(t))
    .map((t) => ({ type: t, label: CATEGORY_TYPE_LABEL[t] ?? t, items: map.get(t)! }));
}

export const CATEGORY_TYPE_LABEL: Record<string, string> = {
  situation: "상황 · 분위기",
  season: "날씨 · 계절",
  credential: "인증 · 신뢰",
  food: "음식 종류",
  price: "가격대",
};
