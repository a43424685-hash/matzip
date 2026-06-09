"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { ChevronDown, Camera, Video, Sparkles, Search, MapPin, Check } from "lucide-react";
import KakaoMap from "@/components/KakaoMap";
import { uploadImage } from "@/lib/imageUpload";
import { uploadVideo } from "@/lib/videoUpload";
import { registerPostAction, type RegisterState } from "@/app/actions/post";
import { PRICE_RANGES, REVISIT_INTENTS, WAITING_LEVELS } from "@/lib/labels";
import { XP_AMOUNT } from "@/server/xp/xpRules";

interface Region {
  id: string;
  name: string;
}
interface CatGroup {
  type: string;
  label: string;
  items: { id: string; name: string }[];
}
interface PlaceResult {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  regionName: string | null;
  kakaoPlaceId: string | null;
  alreadyRegistered?: boolean;
}

interface UploadedImage {
  url: string;
  thumbnailUrl: string;
}

// 추천 태그 우선 노출 순서
const CAT_PRIORITY = [
  "야장", "노포", "가성비", "데이트", "비 오는 날", "혼밥", "분위기",
  "부모님 모시기 좋음", "가족", "겨울 국물", "신상", "회식",
];

export default function RegisterForm({
  regions,
  categoryGroups,
}: {
  regions: Region[];
  categoryGroups: CatGroup[];
}) {
  const [state, action, pending] = useActionState<RegisterState, FormData>(
    registerPostAction,
    undefined
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoThumb, setVideoThumb] = useState("");
  const [videoDuration, setVideoDuration] = useState("");
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoErr, setVideoErr] = useState("");

  async function onPickVideo(file: File | undefined) {
    if (!file) return;
    setUploadingVideo(true);
    setVideoErr("");
    try {
      const { url, thumbnailUrl, duration } = await uploadVideo(file);
      setVideoUrl(url);
      setVideoThumb(thumbnailUrl ?? "");
      setVideoDuration(duration != null ? String(duration) : "");
    } catch (e) {
      setVideoErr(e instanceof Error ? e.message : "영상 업로드에 실패했어요.");
    } finally {
      setUploadingVideo(false);
    }
  }

  async function uploadFiles(files: File[]) {
    const pickedFiles = files
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, Math.max(0, 5 - images.length));
    if (pickedFiles.length === 0) return;
    setUploadingImg(true);
    setUploadErr("");
    try {
      const uploaded: UploadedImage[] = [];
      for (const file of pickedFiles) {
        const { url, thumbnailUrl } = await uploadImage(file, "post");
        uploaded.push({ url, thumbnailUrl: thumbnailUrl ?? url });
      }
      setImages((prev) => [...prev, ...uploaded].slice(0, 5));
    } catch {
      setUploadErr("사진 업로드에 실패했어요. 다시 시도해주세요.");
    } finally {
      setUploadingImg(false);
    }
  }

  function onPickImages(files: FileList | null) {
    if (files) void uploadFiles(Array.from(files));
  }

  // PC: 클립보드 붙여넣기(Ctrl+V) — 화면 어디서든 이미지 붙여넣으면 업로드
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (const it of Array.from(items)) {
        if (it.kind === "file" && it.type.startsWith("image/")) {
          const f = it.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        void uploadFiles(files);
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images.length]);

  function onDropImages(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (files.length > 0) void uploadFiles(files);
  }
  const [shortReview, setShortReview] = useState("");
  const [content, setContent] = useState("");
  const [priceRange, setPriceRange] = useState("");
  const [priceMemo, setPriceMemo] = useState("");
  const [revisitIntent, setRevisitIntent] = useState("");
  const [waitingLevel, setWaitingLevel] = useState("");
  // 장소 검색 / 좌표
  const [name, setName] = useState("");
  const [regionId, setRegionId] = useState("");
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [kakaoPlaceId, setKakaoPlaceId] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<PlaceResult | null>(null); // 선택된 카카오 장소
  const [manualMode, setManualMode] = useState(false); // 직접 입력(예외 흐름)

  async function searchPlace() {
    if (!query.trim()) return;
    setSearching(true);
    setResults(null);
    try {
      const res = await fetch(`/api/places/search?q=${encodeURIComponent(query)}`);
      if (res.ok) setResults((await res.json()).results);
      else setResults([]);
    } catch {
      setResults([]);
    }
    setSearching(false);
  }

  function pick(p: PlaceResult) {
    setName(p.name);
    setAddress(p.address);
    setCoords({ lat: p.latitude, lng: p.longitude });
    setKakaoPlaceId(p.kakaoPlaceId ?? "");
    // 주소 → 17개 시도 자동 매핑 (실패하면 사용자가 직접 선택)
    setRegionId(p.regionName ? regions.find((x) => x.name === p.regionName)?.id ?? "" : "");
    setPicked(p);
    setManualMode(false);
    setResults(null);
    setQuery("");
  }

  // 선택 취소 → 다시 검색 흐름으로
  function clearPick() {
    setPicked(null);
    setName("");
    setAddress("");
    setCoords(null);
    setKakaoPlaceId("");
    setRegionId("");
  }

  // 직접 입력으로 전환 (좌표/장소ID 없음 = 위치 인증 불가)
  function startManual() {
    setManualMode(true);
    setPicked(null);
    setCoords(null);
    setKakaoPlaceId("");
    setResults(null);
    setQuery("");
  }

  // 추천 태그(상황+계절, 우선순위 정렬) 상위 12개
  const recommendedTags = useMemo(() => {
    const pool = categoryGroups
      .filter((g) => g.type === "situation" || g.type === "season")
      .flatMap((g) => g.items);
    return [...pool]
      .sort((a, b) => {
        const ia = CAT_PRIORITY.indexOf(a.name);
        const ib = CAT_PRIORITY.indexOf(b.name);
        return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
      })
      .slice(0, 12);
  }, [categoryGroups]);

  // 위치 인증 시 받을 XP (등록 자체는 0 — 현장에서 위치 인증해야 아래 기록 XP가 한꺼번에 들어옴)
  // 등록 사진/영상 XP는 위치 인증 성공 시 보류분이 함께 지급된다.
  const verifyXp = useMemo(() => {
    let xp = XP_AMOUNT.location_verified + XP_AMOUNT.post_created; // 위치인증 150 + 기본기록 50
    if (images.length > 0) xp += XP_AMOUNT.photo_added;
    if (videoUrl) xp += XP_AMOUNT.video_added;
    if (shortReview.trim()) xp += XP_AMOUNT.short_review;
    if (content.trim()) xp += XP_AMOUNT.detail_review;
    if (selected.size >= 3) xp += XP_AMOUNT.categories;
    if (priceRange) xp += XP_AMOUNT.price;
    if (waitingLevel) xp += XP_AMOUNT.waiting;
    if (revisitIntent) xp += XP_AMOUNT.revisit;
    return xp;
  }, [shortReview, content, selected, priceRange, waitingLevel, revisitIntent, images.length, videoUrl]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function Chip({ id, name }: { id: string; name: string }) {
    const on = selected.has(id);
    return (
      <button
        type="button"
        onClick={() => toggle(id)}
        className={`rounded-full px-3.5 py-2 text-sm font-medium transition active:scale-95 ${
          on ? "bg-forest text-white" : "border border-stone-200 bg-white text-ink"
        }`}
      >
        {name}
      </button>
    );
  }

  return (
    <form action={action} className="space-y-7 pb-28">
      {[...selected].map((id) => (
        <input key={id} type="hidden" name="categoryIds" value={id} />
      ))}

      {/* 필수: 가게 — 카카오 장소 검색이 기본, 직접 입력은 예외 */}
      <div className="space-y-4">
        {/* (A) 장소 검색 흐름 — 기본값 */}
        {!picked && !manualMode && (
          <div className="rounded-2xl bg-stone-50 p-4">
            <p className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-ink-muted">
              <MapPin size={15} /> 어떤 가게인가요? *{" "}
              <span className="font-normal text-stone-400">검색으로 선택하면 위치 인증이 가능해요</span>
            </p>
            <div className="flex gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    searchPlace();
                  }
                }}
                placeholder="상호명·주소로 검색"
                className="input h-11 flex-1"
              />
              <button
                type="button"
                onClick={searchPlace}
                disabled={searching || !query.trim()}
                className="btn-primary h-11 px-4"
              >
                <Search size={16} />
              </button>
            </div>
            {searching && <p className="mt-2 text-xs text-stone-400">검색 중…</p>}
            {results && results.length === 0 && (
              <p className="mt-2 text-xs text-stone-400">결과가 없어요. 더 구체적으로 검색해보세요.</p>
            )}
            {results && results.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {results.map((p, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => pick(p)}
                      className="flex w-full items-center justify-between gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-left active:scale-[0.99]"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-ink">{p.name}</span>
                        <span className="block truncate text-[11px] text-stone-400">
                          {p.address}
                          {p.regionName ? ` · ${p.regionName}` : ""}
                        </span>
                      </span>
                      {p.alreadyRegistered && (
                        <span className="shrink-0 rounded-full bg-forest-soft px-2 py-0.5 text-[10px] font-bold text-forest">
                          등록됨
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={startManual}
              className="mt-3 text-[13px] font-semibold text-stone-500 underline underline-offset-2"
            >
              검색 결과에 없나요? 직접 입력
            </button>
          </div>
        )}

        {/* (B) 선택된 가게 */}
        {picked && (
          <div className="rounded-2xl border border-forest/30 bg-forest-soft/40 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-base font-bold text-ink">{name}</div>
                {address && <div className="mt-0.5 truncate text-[12px] text-stone-500">{address}</div>}
              </div>
              <button
                type="button"
                onClick={clearPick}
                className="shrink-0 text-[13px] font-semibold text-stone-500"
              >
                다른 가게 선택
              </button>
            </div>

            {/* 지역 — 자동 매핑, 실패 시 직접 선택 (필수) */}
            <div className="mt-3">
              <label className="label">지역 *</label>
              <select
                value={regionId}
                onChange={(e) => setRegionId(e.target.value)}
                name="primaryRegionId"
                required
                className="input h-11"
              >
                <option value="" disabled>
                  지역 선택
                </option>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              {!regionId && (
                <p className="mt-1 text-[12px] text-coral-dark">
                  주소에서 지역을 못 찾았어요. 지역을 직접 선택해주세요.
                </p>
              )}
            </div>

            {coords && (
              <KakaoMap
                center={{ lat: coords.lat, lng: coords.lng }}
                name={name || undefined}
                height={150}
                className="mt-3"
              />
            )}
            <p className="mt-2 flex items-center gap-1 text-[12px] font-semibold text-forest">
              <Check size={13} /> 이 가게는 위치 인증이 가능해요 (등록 후 현장에서 방문 인증)
            </p>
            {picked.alreadyRegistered && (
              <p className="mt-1 text-[12px] text-ink-muted">
                이미 등록된 가게예요. 내 방문 기록으로 추가됩니다.
              </p>
            )}

            {/* 제출용 hidden — 상호명 */}
            <input type="hidden" name="name" value={name} />
          </div>
        )}

        {/* (C) 직접 입력 — 예외 흐름 (좌표 없음 = 위치 인증 어려움) */}
        {manualMode && (
          <div className="rounded-2xl border border-stone-200 p-4">
            <div className="space-y-3">
              <div>
                <label className="label">상호명 *</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  name="name"
                  required
                  className="input h-12"
                  placeholder="예) 을지로 골목 노포"
                />
              </div>
              <div>
                <label className="label">지역 *</label>
                <select
                  value={regionId}
                  onChange={(e) => setRegionId(e.target.value)}
                  name="primaryRegionId"
                  required
                  className="input h-12"
                >
                  <option value="" disabled>
                    지역 선택
                  </option>
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="mt-3 text-[12px] text-coral-dark">
              직접 입력한 가게는 좌표가 없어 위치 인증이 어려울 수 있어요. 카카오 장소 검색으로 선택하면 더 정확하게 등록됩니다.
            </p>
            <button
              type="button"
              onClick={() => setManualMode(false)}
              className="mt-2 text-[13px] font-semibold text-forest"
            >
              다시 장소 검색하기
            </button>
          </div>
        )}

        {/* 검색으로 확보한 좌표/주소 (제출용) — 직접 입력이면 빈 값 */}
        <input type="hidden" name="latitude" value={coords?.lat ?? ""} />
        <input type="hidden" name="longitude" value={coords?.lng ?? ""} />
        <input type="hidden" name="address" value={address} />
        <input type="hidden" name="kakaoPlaceId" value={kakaoPlaceId} />
      </div>

      {/* 필수: 카테고리 — 추천 태그 먼저 */}
      <div>
        <label className="label">
          어떤 곳인가요? * <span className="font-normal text-stone-400">3개 이상이면 +30 XP</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {recommendedTags.map((c) => (
            <Chip key={c.id} id={c.id} name={c.name} />
          ))}
        </div>

        <details className="mt-3 rounded-2xl border border-stone-200">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-ink-muted">
            전체 카테고리 보기
            <ChevronDown size={16} />
          </summary>
          <div className="space-y-4 px-4 pb-4">
            {categoryGroups.map((g) => (
              <div key={g.type}>
                <p className="mb-2 text-xs font-semibold text-stone-400">{g.label}</p>
                <div className="flex flex-wrap gap-2">
                  {g.items.map((c) => (
                    <Chip key={c.id} id={c.id} name={c.name} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </details>
        <p className="mt-2 text-[13px] text-forest">{selected.size}개 선택됨</p>
      </div>

      {/* 권장: 사진/영상 + 한줄평 */}
      <div className="space-y-4">
        <div className="rounded-2xl bg-stone-50 p-4">
          <p className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold text-ink-muted">
            <Camera size={15} /> 맛집 사진·영상 (선택)
          </p>
          <p className="mb-3 text-[11px] text-stone-400">
            최대 5장까지 등록 가능해요. <b className="text-forest">첫 번째 사진이 대표사진</b>입니다.
            음식 사진, 가게 전경, 건물 외관, 메뉴판처럼 나중에 다시 찾기 쉬운 사진을 올려주세요.
          </p>
          {images.length > 0 && (
            <div className="mb-3 flex gap-2 overflow-x-auto">
              {images.map((img, index) => (
                <div key={img.url} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-stone-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.thumbnailUrl || img.url} alt={`맛집 사진 ${index + 1}`} className="h-full w-full object-cover" />
                  {index === 0 && (
                    <span className="absolute left-1 top-1 rounded-full bg-forest px-1.5 py-0.5 text-[10px] font-bold text-white">
                      대표
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setImages((prev) => prev.filter((_, i) => i !== index))}
                    className="absolute bottom-1 right-1 rounded-full bg-black/55 px-1.5 py-0.5 text-[10px] font-bold text-white"
                    aria-label="사진 삭제"
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
          )}
          {images.length < 5 && (
            <label
              onDrop={onDropImages}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              className={`flex h-14 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl border text-sm font-semibold active:scale-[0.99] ${
                dragOver ? "border-forest bg-forest-soft/40 text-forest" : "border-stone-200 bg-white text-ink"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Camera size={16} className="text-forest" />
                {uploadingImg ? "업로드 중…" : images.length === 0 ? "사진 추가" : `사진 더 추가 (${images.length}/5)`}
              </span>
              <span className="text-[11px] font-normal text-stone-400">
                PC는 붙여넣기(Ctrl+V)·드래그도 돼요
              </span>
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={uploadingImg}
                onChange={(e) => onPickImages(e.target.files)}
                className="hidden"
              />
            </label>
          )}
          {uploadErr && <p className="mt-1 text-[12px] text-coral-dark">{uploadErr}</p>}
          {images.map((img, index) => (
            <input key={`${img.url}-${index}`} type="hidden" name="imageUrls" value={img.url} />
          ))}
          {images.map((img, index) => (
            <input key={`${img.thumbnailUrl}-${index}`} type="hidden" name="imageThumbUrls" value={img.thumbnailUrl} />
          ))}

          {/* 영상 — 앨범에서 선택 (최대 60초·50MB), 첫 프레임을 자동 썸네일로 */}
          {videoUrl ? (
            <div className="mt-2 flex items-center gap-3">
              {videoThumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={videoThumb} alt="영상 썸네일" className="h-16 w-16 rounded-xl object-cover" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-stone-100 text-stone-400">
                  <Video size={20} />
                </div>
              )}
              <div className="text-sm">
                <div className="font-semibold text-ink">
                  영상 첨부됨{videoDuration ? ` · ${videoDuration}초` : ""}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setVideoUrl("");
                    setVideoThumb("");
                    setVideoDuration("");
                  }}
                  className="text-coral-dark"
                >
                  영상 삭제
                </button>
              </div>
            </div>
          ) : (
            <label className="mt-2 flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-white text-sm font-semibold text-ink active:scale-[0.99]">
              <Video size={16} className="text-forest" />
              {uploadingVideo ? "영상 업로드 중…" : "영상 추가 (최대 60초)"}
              <input
                type="file"
                accept="video/*"
                disabled={uploadingVideo}
                onChange={(e) => onPickVideo(e.target.files?.[0])}
                className="hidden"
              />
            </label>
          )}
          {videoUrl && (
            <label className="mt-2 flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm font-semibold text-ink">
              소리 없이 올리기
              <input type="checkbox" name="videoMuted" className="h-4 w-4 accent-forest" />
            </label>
          )}
          {videoErr && <p className="mt-1 text-[12px] text-coral-dark">{videoErr}</p>}
          <input type="hidden" name="videoUrl" value={videoUrl} />
          <input type="hidden" name="videoThumbUrl" value={videoThumb} />
          <input type="hidden" name="videoDuration" value={videoDuration} />
        </div>

        <div>
          <label className="label">
            한줄평 <span className="font-normal text-stone-400">+40 XP</span>
          </label>
          <input
            value={shortReview}
            onChange={(e) => setShortReview(e.target.value)}
            name="shortReview"
            className="input h-12"
            placeholder="여기 진짜 가성비 미쳤어요"
          />
        </div>
      </div>

      {/* 선택: 더 자세히 (XP 추가) */}
      <details className="rounded-2xl border border-stone-200">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3.5 text-sm font-semibold text-ink">
          <span className="flex items-center gap-1.5">
            <Sparkles size={15} className="text-coral" /> 더 채우고 XP 더 받기
          </span>
          <ChevronDown size={16} />
        </summary>
        <div className="space-y-4 px-4 pb-4">
          <div>
            <label className="label">상세 리뷰 <span className="font-normal text-stone-400">+70 XP</span></label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              name="content"
              rows={3}
              className="input"
              placeholder="자세한 후기를 남겨주세요"
            />
          </div>
          <SelectField name="priceRange" label="가격대" hint="+10 XP" options={PRICE_RANGES} value={priceRange} onChange={setPriceRange} />
          {priceRange === "over_200k" && (
            <div>
              <label className="label">20만원 이상 금액 직접 입력</label>
              <input
                value={priceMemo}
                onChange={(e) => setPriceMemo(e.target.value)}
                name="priceMemo"
                className="input h-12"
                placeholder="예) 1인 25만원 코스, 2인 48만원"
              />
            </div>
          )}
          <SelectField name="revisitIntent" label="재방문 의사" hint="+10 XP" options={REVISIT_INTENTS} value={revisitIntent} onChange={setRevisitIntent} />
          <SelectField name="waitingLevel" label="웨이팅" hint="+10 XP" options={WAITING_LEVELS} value={waitingLevel} onChange={setWaitingLevel} />
        </div>
      </details>

      {state?.error && <p className="text-sm text-coral-dark">{state.error}</p>}

      {/* 하단 고정: 실시간 예상 XP + 등록 */}
      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-stone-200 bg-white px-5 pb-4 pt-3">
        <div className="mb-0.5 flex items-center justify-between">
          <span className="text-sm text-ink-muted">위치 인증하면 받을 XP</span>
          <span className="text-lg font-extrabold tabular-nums text-coral">+{verifyXp} XP</span>
        </div>
        <p className="mb-2 text-[11px] text-stone-400">
          등록만으론 XP 0 · 현장에서 <b>위치 인증</b>하면 위 XP가 한꺼번에 들어와요.
        </p>
        <button
          type="submit"
          disabled={pending || !name.trim() || !regionId}
          className="btn-primary h-12 w-full !text-base"
        >
          {pending ? "등록 중…" : !name.trim() ? "가게를 먼저 선택하세요" : !regionId ? "지역을 선택하세요" : "맛집 등록하기"}
        </button>
      </div>
    </form>
  );
}

function SelectField({
  name,
  label,
  hint,
  options,
  value,
  onChange,
}: {
  name: string;
  label: string;
  hint: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="label">
        {label} <span className="font-normal text-stone-400">{hint}</span>
      </label>
      <select
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input h-12"
      >
        <option value="">선택 안 함</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
