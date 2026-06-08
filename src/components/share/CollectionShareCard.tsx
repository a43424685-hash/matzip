import { MapPin } from "lucide-react";

export interface CollectionShareData {
  title: string;
  regionName: string | null;
  itemCount: number;
  topRestaurants: { name: string; regionName: string }[]; // 대표 3~5개
  nickname: string;
  level: number;
}

/** 컬렉션 공유 카드 (4:6). 외부 이미지 미사용 → 항상 안정적으로 PNG 추출. */
export default function CollectionShareCard({ data }: { data: CollectionShareData }) {
  return (
    <div className="relative flex h-[600px] w-[400px] flex-col justify-between overflow-hidden bg-forest p-7 text-white">
      <div className="pointer-events-none absolute -right-12 -top-14 h-48 w-48 rounded-full bg-white/5" />
      <div className="pointer-events-none absolute -bottom-20 -left-12 h-56 w-56 rounded-full bg-white/5" />

      {/* 상단 */}
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="text-sm font-extrabold tracking-tight">맛집레벨업</span>
          <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold">
            맛집 리스트
          </span>
        </div>

        {data.regionName && (
          <div className="mt-7 flex items-center gap-1 text-[13px] font-medium text-white/70">
            <MapPin size={14} /> {data.regionName}
          </div>
        )}
        <h2 className="mt-1.5 text-[30px] font-black leading-tight tracking-tight">
          {data.title}
        </h2>
        <p className="mt-1.5 text-[15px] font-semibold text-coral">
          맛집 {data.itemCount}곳
        </p>
      </div>

      {/* 대표 맛집 목록 */}
      <div className="relative space-y-2.5">
        {data.topRestaurants.map((r, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/15 text-sm font-extrabold">
              {i + 1}
            </span>
            <div className="min-w-0">
              <div className="truncate text-[17px] font-bold leading-tight">{r.name}</div>
              <div className="text-[12px] text-white/60">{r.regionName}</div>
            </div>
          </div>
        ))}
        {data.itemCount > data.topRestaurants.length && (
          <div className="pl-10 text-[13px] text-white/60">
            외 {data.itemCount - data.topRestaurants.length}곳 더
          </div>
        )}
      </div>

      {/* 하단 */}
      <div className="relative flex items-center justify-between border-t border-white/15 pt-4">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-coral px-2 py-1 text-xs font-extrabold">
            Lv.{data.level}
          </span>
          <span className="text-sm font-semibold">{data.nickname}의 리스트</span>
        </div>
        <span className="text-[11px] text-white/60">맛집레벨업</span>
      </div>
    </div>
  );
}
