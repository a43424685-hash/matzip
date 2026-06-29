"use client";

import { useActionState, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Camera, Video, Sparkles, Search, MapPin, Check, ChevronLeft, ChevronRight } from "lucide-react";
import KakaoMap from "@/components/KakaoMap";
import { uploadImage } from "@/lib/imageUpload";
import { uploadVideo } from "@/lib/videoUpload";
import { markScrollReset } from "@/lib/scrollReset";
import { track } from "@/lib/analytics";
import { registerPostAction, updatePostAction, type RegisterState } from "@/app/actions/post";
import {
  ATMOSPHERE_TAGS,
  PRICE_RANGES,
  REVISIT_INTENTS,
  WAITING_LEVELS,
} from "@/lib/labels";
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
  categoryName?: string | null;
  foodCategory?: string | null;
  alreadyRegistered?: boolean;
}

interface UploadedImage {
  url: string;
  thumbnailUrl: string;
}

export interface InitialPost {
  postId: string;
  name: string;
  regionId: string;
  address: string;
  shortReview: string;
  content: string;
  priceRange: string;
  priceMemo: string;
  tasteRating: string;
  tasteTags: string[];
  serviceRating: string;
  serviceTags: string[];
  atmosphereTags: string[];
  revisitIntent: string;
  waitingLevel: string;
  categoryIds: string[];
  images: UploadedImage[];
  videoUrl: string;
  videoThumb: string;
  videoDuration: string;
}

export default function RegisterForm({
  regions,
  categoryGroups,
  mode = "create",
  initial,
}: {
  regions: Region[];
  categoryGroups: CatGroup[];
  mode?: "create" | "edit";
  initial?: InitialPost;
}) {
  const isEdit = mode === "edit";
  const router = useRouter();
  const [state, action, pending] = useActionState<RegisterState, FormData>(
    isEdit ? updatePostAction : registerPostAction,
    undefined
  );
  // 수정 완료 시: 수정 페이지를 히스토리에서 치우고 상세로 (replace) → 뒤로가기하면 홈/이전으로
  useEffect(() => {
    if (state && "redirectTo" in state && state.redirectTo) {
      track(isEdit ? "post_updated" : "post_created");
      markScrollReset();
      router.replace(state.redirectTo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  const [selected, setSelected] = useState<Set<string>>(new Set(initial?.categoryIds ?? []));
  const [images, setImages] = useState<UploadedImage[]>(initial?.images ?? []);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [videoUrl, setVideoUrl] = useState(initial?.videoUrl ?? "");
  const [videoThumb, setVideoThumb] = useState(initial?.videoThumb ?? "");
  const [videoDuration, setVideoDuration] = useState(initial?.videoDuration ?? "");
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

  // 사진 순서 변경 (앞으로/뒤로) — 첫 번째가 대표사진
  function moveImage(index: number, dir: -1 | 1) {
    setImages((prev) => {
      const next = [...prev];
      const to = index + dir;
      if (to < 0 || to >= next.length) return prev;
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
  }
  const [shortReview, setShortReview] = useState(initial?.shortReview ?? "");
  const [priceRange, setPriceRange] = useState(initial?.priceRange ?? "");
  const [priceMemo, setPriceMemo] = useState(initial?.priceMemo ?? "");
  const [atmosphereTags, setAtmosphereTags] = useState<Set<string>>(new Set(initial?.atmosphereTags ?? []));
  const [revisitIntent, setRevisitIntent] = useState(initial?.revisitIntent ?? "");
  const [waitingLevel, setWaitingLevel] = useState(initial?.waitingLevel ?? "");
  // 공개 범위: 등록 시 반드시 직접 선택 (기본값 없음 → 안 고르면 등록 불가)
  const [visibility, setVisibility] = useState<"public" | "private" | null>(null);
  // 단계별 등록(create 모드만). 0:가게 1:카테고리 2:사진·한줄평 3:공개여부
  const TOTAL_STEPS = 4;
  const [step, setStep] = useState(0);
  // 음식/어떤가게/인증 그룹 분리 (날씨·계절·가격 태그는 등록에서 제외)
  const foodGroup = categoryGroups.find((g) => g.type === "food")?.items ?? [];
  const situationGroup = categoryGroups.find((g) => g.type === "situation")?.items ?? [];
  const credentialGroup = categoryGroups.find((g) => g.type === "credential")?.items ?? [];
  const stepShown = (n: number) => (isEdit ? "" : step === n ? "" : "hidden");
  // 장소 검색 / 좌표
  const [name, setName] = useState(initial?.name ?? "");
  const [regionId, setRegionId] = useState(initial?.regionId ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [kakaoPlaceId, setKakaoPlaceId] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<PlaceResult | null>(null); // 선택된 카카오 장소
  const [manualMode, setManualMode] = useState(false); // 직접 입력(예외 흐름)
  const placeChosen = !!(name.trim() && regionId);
  // 단계 진행 가능 여부
  const canNext = step === 0 ? placeChosen : step === 1 ? selected.size >= 1 : true;

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
    // 음식 종류 자동 선택 (카카오 분류 기반) — 틀리면 사용자가 칩에서 바꿀 수 있음
    if (p.foodCategory) {
      const foodId = categoryGroups
        .find((g) => g.type === "food")
        ?.items.find((c) => c.name === p.foodCategory)?.id;
      if (foodId) setSelected((prev) => new Set(prev).add(foodId));
    }
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

  // 위치 인증 시 받을 XP (등록 자체는 0 — 현장에서 위치 인증해야 아래 기록 XP가 한꺼번에 들어옴)
  // 등록 사진/영상 XP는 위치 인증 성공 시 보류분이 함께 지급된다.
  const verifyXp = useMemo(() => {
    let xp = XP_AMOUNT.location_verified + XP_AMOUNT.post_created; // 위치인증 150 + 기본기록 50
    if (images.length > 0) xp += XP_AMOUNT.photo_added;
    if (videoUrl) xp += XP_AMOUNT.video_added;
    if (shortReview.trim()) xp += XP_AMOUNT.short_review;
    // 카테고리 XP는 "개수 채우기"가 아니라 1개만 정확히 골라도 지급 (헛태그 방지)
    if (selected.size >= 1) xp += XP_AMOUNT.categories;
    if (priceRange) xp += XP_AMOUNT.price;
    if (waitingLevel) xp += XP_AMOUNT.waiting;
    if (revisitIntent) xp += XP_AMOUNT.revisit;
    return xp;
  }, [shortReview, selected, priceRange, waitingLevel, revisitIntent, images.length, videoUrl]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleValue(setter: Dispatch<SetStateAction<Set<string>>>, value: string) {
    setter((prev) => {
      const next = new Set(prev);
      next.has(value) ? next.delete(value) : next.add(value);
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
      {isEdit && initial && <input type="hidden" name="postId" value={initial.postId} />}
      {[...selected].map((id) => (
        <input key={id} type="hidden" name="categoryIds" value={id} />
      ))}
      {[...atmosphereTags].map((id) => (
        <input key={id} type="hidden" name="atmosphereTags" value={id} />
      ))}

      {!isEdit && (
        <div className="mb-1 flex items-center gap-1.5">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-forest" : "bg-stone-200"}`}
            />
          ))}
        </div>
      )}

      {/* STEP 0: 가게 선택 — 카카오 장소 검색이 기본, 직접 입력은 예외 */}
      <div className={`space-y-4 ${stepShown(0)}`}>
        {!isEdit && <p className="text-lg font-extrabold text-ink">1 / 4 · 가게 선택</p>}
        {/* (A) 장소 검색 흐름 — 기본값 (수정 모드에선 가게 변경 불가) */}
        {!isEdit && !picked && !manualMode && (
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

        {/* (B) 선택된 가게 (수정 모드에선 가게 고정·읽기전용) */}
        {(picked || isEdit) && (
          <div className="rounded-2xl border border-forest/30 bg-forest-soft/40 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-base font-bold text-ink">{name}</div>
                {address && <div className="mt-0.5 truncate text-[12px] text-stone-500">{address}</div>}
                {isEdit && <div className="mt-0.5 text-[11px] text-stone-400">가게·지역은 수정할 수 없어요</div>}
              </div>
              {!isEdit && (
                <button
                  type="button"
                  onClick={clearPick}
                  className="shrink-0 text-[13px] font-semibold text-stone-500"
                >
                  다른 가게 선택
                </button>
              )}
            </div>

            {/* 지역 — 자동 매핑, 실패 시 직접 선택 (필수) */}
            <div className="mt-3">
              <label className="label">지역 *</label>
              <select
                value={regionId}
                onChange={(e) => setRegionId(e.target.value)}
                name="primaryRegionId"
                required
                disabled={isEdit}
                className="input h-11 disabled:opacity-60"
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
            {!isEdit && (
              <p className="mt-2 flex items-center gap-1 text-[12px] font-semibold text-forest">
                <Check size={13} /> 이 가게는 위치 인증이 가능해요 (등록 후 현장에서 방문 인증)
              </p>
            )}
            {picked?.alreadyRegistered && (
              <p className="mt-1 text-[12px] text-ink-muted">
                이미 등록된 가게예요. 내 방문 기록으로 추가됩니다.
              </p>
            )}

            {/* 제출용 hidden — 상호명 */}
            <input type="hidden" name="name" value={name} />
          </div>
        )}

        {/* (C) 직접 입력 — 예외 흐름 (좌표 없음 = 위치 인증 어려움) */}
        {!isEdit && manualMode && (
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

      {/* STEP 1: 카테고리 (음식 → 어떤 가게 → 인증). 날씨·계절·가격 태그는 등록에서 제외 */}
      <div className={`space-y-5 ${stepShown(1)}`}>
        {!isEdit && <p className="text-lg font-extrabold text-ink">2 / 4 · 어떤 곳인가요</p>}
        <div>
          <label className="label">
            무슨 음식이에요? <span className="font-normal text-stone-400">가게를 고르면 자동 선택돼요 (바꿀 수 있어요)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {foodGroup.map((c) => (
              <Chip key={c.id} id={c.id} name={c.name} />
            ))}
          </div>
        </div>
        <div>
          <label className="label">
            어떤 가게예요? <span className="font-normal text-stone-400">해당되는 것만</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {situationGroup.map((c) => (
              <Chip key={c.id} id={c.id} name={c.name} />
            ))}
          </div>
        </div>
        {credentialGroup.length > 0 && (
          <div>
            <label className="label">
              인증 <span className="font-normal text-stone-400">있으면 선택</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {credentialGroup.map((c) => (
                <Chip key={c.id} id={c.id} name={c.name} />
              ))}
            </div>
          </div>
        )}
        <p className="text-[13px] text-forest">{selected.size}개 선택됨</p>
      </div>

      {/* STEP 2: 사진/영상 + 한줄평 */}
      <div className={`space-y-4 ${stepShown(2)}`}>
        {!isEdit && <p className="text-lg font-extrabold text-ink">3 / 4 · 사진과 한줄평</p>}
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
                  {/* 순서 변경 */}
                  <div className="absolute inset-x-0 top-0 flex justify-between px-0.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => moveImage(index, -1)}
                      disabled={index === 0}
                      className="flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white disabled:opacity-30"
                      aria-label="앞으로"
                    >
                      <ChevronLeft size={13} strokeWidth={3} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveImage(index, 1)}
                      disabled={index === images.length - 1}
                      className="flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white disabled:opacity-30"
                      aria-label="뒤로"
                    >
                      <ChevronRight size={13} strokeWidth={3} />
                    </button>
                  </div>
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
          <textarea
            value={shortReview}
            onChange={(e) => setShortReview(e.target.value)}
            name="shortReview"
            rows={2}
            maxLength={60}
            className="input resize-none"
            placeholder="여기 진짜 가성비 미쳤어요 (두 줄까지)"
          />
        </div>
      </div>

      {/* STEP 2(이어서): 더 자세히 (XP 추가) */}
      <details className={`rounded-2xl border border-stone-200 ${stepShown(2)}`}>
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3.5 text-sm font-semibold text-ink">
          <span className="flex items-center gap-1.5">
            <Sparkles size={15} className="text-coral" /> 더 채우고 XP 더 받기
          </span>
          <ChevronDown size={16} />
        </summary>
        <div className="space-y-4 px-4 pb-4">
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

      {/* STEP 3: 공개 범위 선택 (등록 시에만) */}
      {!isEdit && (
        <div className={stepShown(3)}>
          <p className="mb-2 text-lg font-extrabold text-ink">4 / 4 · 공개 여부</p>
          <label className="label">이 맛집, 어떻게 할까요?</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setVisibility("public")}
              className={`rounded-2xl border p-3 text-left transition active:scale-[0.99] ${
                visibility === "public" ? "border-forest bg-forest-soft/40" : "border-stone-200 bg-white"
              }`}
            >
              <span className="block text-sm font-bold text-ink">모두에게 공개</span>
              <span className="mt-0.5 block text-[12px] text-ink-muted">검색·지도에 떠요</span>
            </button>
            <button
              type="button"
              onClick={() => setVisibility("private")}
              className={`rounded-2xl border p-3 text-left transition active:scale-[0.99] ${
                visibility === "private" ? "border-forest bg-forest-soft/40" : "border-stone-200 bg-white"
              }`}
            >
              <span className="block text-sm font-bold text-ink">나만 보관</span>
              <span className="mt-0.5 block text-[12px] text-ink-muted">남에게 안 보임</span>
            </button>
          </div>
          <p className="mt-1.5 text-[12px] text-stone-400">
            나중에 팔 생각이 있는 아끼는 맛집이라면 ‘나만 보관’을 추천해요.
          </p>
          {!visibility && (
            <p className="mt-1 text-[12px] font-semibold text-coral-dark">공개 여부를 선택해야 등록할 수 있어요.</p>
          )}
          <input type="hidden" name="visibility" value={visibility ?? ""} />
        </div>
      )}

      {state?.error && <p className="text-sm text-coral-dark">{state.error}</p>}

      {/* 하단 고정: 단계 이동 / 등록 */}
      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-stone-200 bg-white px-5 pb-4 pt-3">
        {!isEdit && step === TOTAL_STEPS - 1 && (
          <>
            <div className="mb-0.5 flex items-center justify-between">
              <span className="text-sm text-ink-muted">위치 인증하면 받을 XP</span>
              <span className="text-lg font-extrabold tabular-nums text-coral">+{verifyXp} XP</span>
            </div>
            <p className="mb-2 text-[11px] text-stone-400">
              등록만으론 XP 0 · 현장에서 <b>위치 인증</b>하면 위 XP가 한꺼번에 들어와요.
            </p>
          </>
        )}

        {isEdit ? (
          <button
            type="submit"
            disabled={pending || !name.trim() || !regionId}
            className="btn-primary h-12 w-full !text-base"
          >
            {pending ? "수정 중…" : "수정 완료"}
          </button>
        ) : (
          <div className="flex gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                className="h-12 flex-1 rounded-xl border border-stone-200 bg-white text-base font-semibold text-ink active:scale-[0.99]"
              >
                이전
              </button>
            )}
            {step < TOTAL_STEPS - 1 ? (
              <button
                type="button"
                onClick={() => canNext && setStep((s) => s + 1)}
                disabled={!canNext}
                className="btn-primary h-12 flex-[2] !text-base"
              >
                {step === 0 && !placeChosen
                  ? "가게를 먼저 선택하세요"
                  : step === 1 && selected.size < 1
                    ? "카테고리를 골라주세요"
                    : "다음"}
              </button>
            ) : (
              <button
                type="submit"
                disabled={pending || !name.trim() || !regionId || !visibility}
                className="btn-primary h-12 flex-[2] !text-base"
              >
                {pending ? "등록 중…" : !visibility ? "공개 여부를 선택하세요" : "맛집 등록하기"}
              </button>
            )}
          </div>
        )}
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


function MultiChoice({
  selected,
  onToggle,
  options,
}: {
  selected: Set<string>;
  onToggle: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = selected.has(o.value);
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onToggle(o.value)}
            className={`rounded-full px-3.5 py-2 text-sm font-medium transition active:scale-95 ${
              on ? "bg-forest text-white" : "border border-stone-200 bg-white text-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
