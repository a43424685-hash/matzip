"use client";

const CHIP =
  "flex cursor-pointer items-center rounded-full border border-stone-200 bg-white px-3.5 py-2 text-sm font-medium text-ink transition active:scale-95 has-[:checked]:border-forest has-[:checked]:bg-forest has-[:checked]:text-white";

/**
 * 검색 추천/카테고리 칩 — 누르면 즉시 검색(폼 자동 제출).
 * GET 폼 안에 두면 체크 토글 시 바로 결과가 갱신된다.
 */
export default function SearchChip({ id, name, checked }: { id: string; name: string; checked: boolean }) {
  return (
    <label className={CHIP}>
      <input
        type="checkbox"
        name="categoryIds"
        value={id}
        defaultChecked={checked}
        className="sr-only"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      />
      {name}
    </label>
  );
}
