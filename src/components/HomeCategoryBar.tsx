import Link from "next/link";

interface HomeCategory {
  id: string;
  name: string;
}

/**
 * 카테고리 가로 메뉴 — 헤더가 스크롤로 사라지면 상단에 고정.
 *
 * native CSS `position: sticky` 사용 (JS 고정 금지).
 * 이유: iOS 사파리는 관성 스크롤 중 scroll/IntersectionObserver 콜백을 실행하지 않고
 * 멈춘 뒤에야 실행한다. JS로 fixed 전환하면 내릴 때 안 따라오다가 멈추면 "탁" 나타나는
 * 끊김이 생긴다. native sticky 는 GPU 합성이라 관성 스크롤을 끊김 없이 따라간다.
 * (상위 박스에 overflow/transform 이 없어야 동작 — 현재 홈은 모두 clean)
 */
export default function HomeCategoryBar({ categories }: { categories: HomeCategory[] }) {
  return (
    <nav className="sticky top-0 z-40 mt-4 border-b border-stone-100 bg-white">
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 py-3">
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/search?categoryIds=${c.id}`}
            className="shrink-0 rounded-full border border-stone-200 bg-white px-3.5 py-1.5 text-[13px] font-semibold text-ink active:scale-95"
          >
            {c.name}
          </Link>
        ))}
      </div>
    </nav>
  );
}
