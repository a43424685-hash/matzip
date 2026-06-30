import Link from "next/link";
import { MapPin, ShieldCheck } from "lucide-react";
import CardImage from "@/components/CardImage";
import type { StoreMapCard as Card } from "@/server/store/StoreService";

/** 가로 스크롤용 세로 타일 (커버 위, 정보 아래) */
export function StoreTile({ map }: { map: Card }) {
  return (
    <Link
      href={`/collections/${map.id}`}
      className="flex h-[256px] w-[190px] shrink-0 flex-col rounded-2xl border border-stone-200 bg-white p-2 active:scale-[0.99]"
    >
      <div className="relative h-[132px] overflow-hidden rounded-xl bg-stone-100">
        {map.coverMedia ? (
          <CardImage src={map.coverMedia} alt={map.title} label="사진 준비 중" className="h-full w-full object-cover" />
        ) : (
          <div className="thumb-empty h-full w-full" />
        )}
        <span className="absolute right-2 top-2 rounded-full bg-forest px-2 py-0.5 text-[11px] font-extrabold text-white">
          {map.price.toLocaleString()}원
        </span>
      </div>
      <div className="mt-2 line-clamp-2 min-h-[38px] text-sm font-bold leading-tight text-ink">{map.title}</div>
      <div className="truncate text-[12px] text-stone-400">
        {map.regionName} · 맛집 {map.itemCount}곳{map.purchaseCount > 0 && ` · 🔥${map.purchaseCount}`}
      </div>
      <div className="mt-auto flex items-center gap-1 truncate text-[11px] font-semibold text-forest">
        <ShieldCheck size={11} className="shrink-0" /> {map.creatorNickname} · 인증 {map.creatorVerifiedCount}곳
      </div>
    </Link>
  );
}

/** 검색결과 리스트용 가로 행 (커버 좌, 정보 우) */
export function StoreRow({ map }: { map: Card }) {
  return (
    <Link
      href={`/collections/${map.id}`}
      className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-2.5 active:scale-[0.99]"
    >
      <div className="relative h-[76px] w-[76px] shrink-0 overflow-hidden rounded-xl bg-stone-100">
        {map.coverMedia ? (
          <CardImage src={map.coverMedia} alt={map.title} label="" className="h-full w-full object-cover" />
        ) : (
          <div className="thumb-empty h-full w-full" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold text-ink">{map.title}</div>
        <div className="mt-0.5 flex items-center gap-1 truncate text-[12px] text-ink-muted">
          <MapPin size={11} className="shrink-0" /> {map.regionName} · 맛집 {map.itemCount}곳
          {map.purchaseCount > 0 && ` · 🔥${map.purchaseCount}`}
        </div>
        <div className="mt-0.5 flex items-center gap-1 truncate text-[11px] font-semibold text-forest">
          <ShieldCheck size={11} className="shrink-0" /> {map.creatorNickname} · 인증 {map.creatorVerifiedCount}곳
        </div>
      </div>
      <div className="shrink-0 pr-1 text-sm font-black text-forest">{map.price.toLocaleString()}원</div>
    </Link>
  );
}
