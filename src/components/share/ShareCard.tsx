import { MapPin } from "lucide-react";

export interface ShareCardData {
  restaurantName: string;
  regionName: string;
  shortReview: string | null;
  categories: string[];
  nickname: string;
  level: number;
}

/**
 * 공유용 브랜드 카드 (4:5). 외부 이미지를 쓰지 않아 html-to-image 로 항상 안정적으로
 * PNG 추출된다. 가게명·지역·한줄평·카테고리·Lv·워터마크 포함.
 */
export default function ShareCard({ data }: { data: ShareCardData }) {
  return (
    <div className="relative flex h-[500px] w-[400px] flex-col justify-between overflow-hidden bg-forest p-7 text-white">
      {/* 배경 장식 */}
      <div className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-white/5" />
      <div className="pointer-events-none absolute -bottom-16 -left-10 h-52 w-52 rounded-full bg-white/5" />

      {/* 상단: 워터마크 + 라벨 */}
      <div className="relative flex items-center justify-between">
        <span className="text-sm font-extrabold tracking-tight">맛집레벨업</span>
        <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold">
          내 맛집 컬렉션
        </span>
      </div>

      {/* 중앙: 가게명 + 지역 + 한줄평 */}
      <div className="relative">
        <div className="flex items-center gap-1 text-[13px] font-medium text-white/70">
          <MapPin size={14} /> {data.regionName}
        </div>
        <h2 className="mt-1.5 text-[32px] font-black leading-tight tracking-tight">
          {data.restaurantName}
        </h2>
        {data.shortReview && (
          <p className="mt-3 line-clamp-3 text-[17px] font-medium leading-snug text-white/90">
            “{data.shortReview}”
          </p>
        )}

        {data.categories.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {data.categories.slice(0, 4).map((c) => (
              <span
                key={c}
                className="rounded-full bg-white/15 px-3 py-1 text-[13px] font-semibold"
              >
                {c}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 하단: 작성자 Lv + 워터마크 */}
      <div className="relative flex items-center justify-between border-t border-white/15 pt-4">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-coral px-2 py-1 text-xs font-extrabold">
            Lv.{data.level}
          </span>
          <span className="text-sm font-semibold">{data.nickname}</span>
        </div>
        <span className="text-[11px] text-white/60">맛집레벨업에서 발견</span>
      </div>
    </div>
  );
}
