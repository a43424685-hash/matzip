"use client";

import { useRef, useState } from "react";
import { ImagePlus, MapPin, Loader2, Check, X, ArrowLeft } from "lucide-react";
import { uploadImage } from "@/lib/imageUpload";
import { PRICE_RANGES } from "@/lib/labels";
import {
  parseNaverFolder,
  bulkCreateOperatorPicks,
  type ParsedPlace,
  type BulkResult,
} from "@/app/actions/admin-import";

type Cat = { id: string; name: string };
type Media = { type: "image" | "video"; url: string; thumbnailUrl: string | null };
type Item = ParsedPlace & {
  situationCategoryIds: string[];
  priceRange: string;
  shortReview: string;
  media: Media[];
  uploading: boolean;
};

export default function BulkImportWizard({ foodCats, situationCats }: { foodCats: Cat[]; situationCats: Cat[] }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [folderName, setFolderName] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [results, setResults] = useState<BulkResult[]>([]);

  const fresh = items.filter((i) => !i.duplicate);
  const dups = items.filter((i) => i.duplicate);

  async function doParse() {
    setErr("");
    setBusy(true);
    try {
      const r = await parseNaverFolder(link);
      setFolderName(r.folderName);
      setItems(
        r.places.map((p) => ({ ...p, situationCategoryIds: [], priceRange: "", shortReview: "", media: [], uploading: false }))
      );
      setStep(2);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "불러오지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  function update(idx: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  async function addPhoto(idx: number, file: File) {
    if (!file.type.startsWith("image/")) return;
    update(idx, { uploading: true });
    try {
      const up = await uploadImage(file, "post");
      setItems((prev) =>
        prev.map((it, i) =>
          i === idx
            ? { ...it, media: [...it.media, { type: "image", url: up.url, thumbnailUrl: up.thumbnailUrl }], uploading: false }
            : it
        )
      );
    } catch {
      update(idx, { uploading: false });
    }
  }

  async function doSubmit() {
    setBusy(true);
    try {
      const res = await bulkCreateOperatorPicks(
        fresh.map((it) => ({
          name: it.name,
          address: it.address || null,
          lat: it.lat,
          lng: it.lng,
          regionId: it.regionId,
          foodCategoryId: it.foodCategoryId,
          situationCategoryIds: it.situationCategoryIds,
          priceRange: it.priceRange || null,
          shortReview: it.shortReview || null,
          media: it.media,
        }))
      );
      setResults(res);
      setStep(3);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-[100dvh] bg-stone-50 pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-stone-200 bg-white px-4 py-3">
        {step === 2 && (
          <button onClick={() => setStep(1)} className="text-stone-400">
            <ArrowLeft size={20} />
          </button>
        )}
        <h1 className="text-base font-extrabold text-ink">운영자 일괄등록</h1>
        <span className="ml-auto text-[12px] font-semibold text-stone-400">
          {step === 1 ? "1 · 가져오기" : step === 2 ? "2 · 채우기" : "3 · 완료"}
        </span>
      </header>

      {/* STEP 1 — 링크 가져오기 */}
      {step === 1 && (
        <div className="px-5 pt-6">
          <p className="text-[15px] font-bold text-ink">네이버 즐겨찾기 공유링크를 붙여넣어요</p>
          <p className="mt-1 text-[13px] text-ink-muted">
            네이버 지도에서 즐겨찾기 폴더 → 공유 → 링크 복사 → 여기 붙여넣기.
            <br />
            상호·주소·좌표·카테고리는 자동으로 채워져요.
          </p>
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://naver.me/..."
            className="input mt-4"
            autoCapitalize="none"
            spellCheck={false}
          />
          {err && <p className="mt-2 text-[13px] text-coral-dark">{err}</p>}
          <button onClick={doParse} disabled={busy || !link.trim()} className="btn-primary mt-4 w-full">
            {busy ? "불러오는 중…" : "가져오기"}
          </button>
          <p className="mt-3 text-[12px] text-stone-400">
            ※ 운영자 PICK으로 등록돼요. 사진·한줄평·태그·가격은 다음 단계에서 채우거나 비워둘 수 있어요(전부 선택).
          </p>
        </div>
      )}

      {/* STEP 2 — 가게별 채우기 */}
      {step === 2 && (
        <div className="px-4 pt-4">
          <p className="px-1 text-[13px] text-ink-muted">
            <b className="text-ink">{folderName || "즐겨찾기"}</b> · 등록할 {fresh.length}곳
            {dups.length > 0 && <span className="text-stone-400"> · 이미 등록 {dups.length}곳 제외</span>}
          </p>

          <div className="mt-3 space-y-3">
            {items.map((it, idx) =>
              it.duplicate ? (
                <div key={idx} className="flex items-center gap-2 rounded-2xl border border-stone-200 bg-stone-100 px-4 py-3 opacity-70">
                  <span className="text-[13px] font-bold text-stone-500 line-through">{it.name}</span>
                  <span className="ml-auto rounded-full bg-stone-300 px-2 py-0.5 text-[11px] font-bold text-stone-600">이미 등록됨</span>
                </div>
              ) : (
                <ItemCard
                  key={idx}
                  it={it}
                  foodCats={foodCats}
                  situationCats={situationCats}
                  onUpdate={(patch) => update(idx, patch)}
                  onAddPhoto={(f) => addPhoto(idx, f)}
                />
              )
            )}
          </div>

          <div className="fixed inset-x-0 bottom-0 border-t border-stone-200 bg-white p-4">
            <button onClick={doSubmit} disabled={busy || fresh.length === 0} className="btn-primary w-full">
              {busy ? "등록 중…" : `${fresh.length}곳 운영자 PICK으로 등록`}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3 — 결과 */}
      {step === 3 && (
        <div className="px-5 pt-6">
          <p className="text-[15px] font-extrabold text-ink">
            ✅ {results.filter((r) => r.ok).length}곳 등록 완료
            {results.some((r) => !r.ok) && <span className="text-coral-dark"> · {results.filter((r) => !r.ok).length}곳 실패</span>}
          </p>
          <div className="mt-4 space-y-1.5">
            {results.map((r, i) => (
              <div key={i} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-[13px]">
                {r.ok ? <Check size={15} className="text-forest" /> : <X size={15} className="text-coral-dark" />}
                <span className="font-semibold text-ink">{r.name}</span>
                {!r.ok && <span className="ml-auto text-[12px] text-stone-400">{r.error}</span>}
              </div>
            ))}
          </div>
          <a href="/me/admin/import" className="btn-outline mt-6 block w-full text-center">또 가져오기</a>
        </div>
      )}
    </main>
  );
}

function ItemCard({
  it,
  foodCats,
  situationCats,
  onUpdate,
  onAddPhoto,
}: {
  it: Item;
  foodCats: Cat[];
  situationCats: Cat[];
  onUpdate: (patch: Partial<Item>) => void;
  onAddPhoto: (f: File) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const toggle = (id: string) =>
    onUpdate({
      situationCategoryIds: it.situationCategoryIds.includes(id)
        ? it.situationCategoryIds.filter((x) => x !== id)
        : [...it.situationCategoryIds, id],
    });

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-3.5">
      <div className="flex items-baseline gap-2">
        <span className="text-[15px] font-extrabold text-ink">{it.name}</span>
        <span className="rounded-full bg-forest-soft px-1.5 py-0.5 text-[10px] font-bold text-forest">{it.regionName}</span>
      </div>
      <p className="mt-0.5 flex items-center gap-1 text-[12px] text-ink-muted">
        <MapPin size={11} className="shrink-0" /> {it.address || "주소 없음"}
      </p>

      {/* 음식 카테고리 (자동, 수정가능) */}
      <div className="mt-3 flex items-center gap-2">
        <span className="text-[12px] font-semibold text-stone-500">음식</span>
        <select
          value={it.foodCategoryId ?? ""}
          onChange={(e) => onUpdate({ foodCategoryId: e.target.value || null })}
          className="h-9 flex-1 rounded-lg border border-stone-200 bg-white px-2 text-[13px]"
        >
          <option value="">선택 안 함</option>
          {foodCats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {it.naverCategory && <span className="text-[11px] text-stone-400">네이버: {it.naverCategory}</span>}
      </div>

      {/* 사진 */}
      <div className="mt-3 flex flex-wrap gap-2">
        {it.media.map((m, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={m.thumbnailUrl ?? m.url} alt="" className="h-16 w-16 rounded-lg object-cover" />
        ))}
        <button
          onClick={() => fileRef.current?.click()}
          onPaste={(e) => {
            const f = e.clipboardData.files?.[0];
            if (f) onAddPhoto(f);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) onAddPhoto(f);
          }}
          className="flex h-16 w-16 flex-col items-center justify-center rounded-lg border border-dashed border-stone-300 text-stone-400"
        >
          {it.uploading ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
          <span className="mt-0.5 text-[10px]">사진</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onAddPhoto(f);
            e.target.value = "";
          }}
        />
      </div>

      {/* 한줄평 */}
      <input
        value={it.shortReview}
        onChange={(e) => onUpdate({ shortReview: e.target.value })}
        placeholder="한줄평 (선택) — 사진 보고 기억나는 대로"
        className="input mt-3 !h-10 !text-[13px]"
      />

      {/* 상황 태그 */}
      <div className="mt-3">
        <p className="text-[12px] font-semibold text-stone-500">상황 태그 (검색·테마 분류)</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {situationCats.map((c) => {
            const on = it.situationCategoryIds.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggle(c.id)}
                className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${
                  on ? "bg-forest text-white" : "border border-stone-200 bg-white text-ink-muted"
                }`}
              >
                {c.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* 가격대 */}
      <div className="mt-3 flex items-center gap-2">
        <span className="text-[12px] font-semibold text-stone-500">가격</span>
        <select
          value={it.priceRange}
          onChange={(e) => onUpdate({ priceRange: e.target.value })}
          className="h-9 flex-1 rounded-lg border border-stone-200 bg-white px-2 text-[13px]"
        >
          <option value="">선택 안 함</option>
          {PRICE_RANGES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
