"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, X, Loader2, ShieldCheck } from "lucide-react";
import { uploadImage } from "@/lib/imageUpload";
import { COMMUNITY_CATEGORIES } from "@/lib/community";

export default function CommunityWriteForm({ initialCategory }: { initialCategory?: string }) {
  const router = useRouter();
  const [category, setCategory] = useState(initialCategory || "recommend");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");
  const imgInput = useRef<HTMLInputElement>(null);

  async function onPickImages(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setErr("");
    try {
      const room = Math.max(0, 10 - images.length);
      for (const f of Array.from(files).slice(0, room)) {
        const up = await uploadImage(f);
        setImages((prev) => [...prev, up.url]);
      }
    } catch {
      setErr("사진 업로드에 실패했어요.");
    }
    setUploading(false);
  }

  async function submit() {
    if (busy || uploading) return;
    if (!title.trim() || !content.trim()) {
      setErr("제목과 내용을 입력해주세요.");
      return;
    }
    // 가드레일: 전화번호 등 특정 가게 식별정보 자유텍스트 차단(저격/명예훼손 방지)
    const joined = `${title} ${content}`;
    if (/(01[0-9]|0\d{1,2})[-\s.]?\d{3,4}[-\s.]?\d{4}/.test(joined)) {
      setErr("전화번호는 올릴 수 없어요. 특정 가게는 '맛집 카드'로 첨부하고, 평가는 그 가게의 정직 후기로 남겨주세요.");
      return;
    }
    setBusy(true);
    setErr("");
    const r = await fetch("/api/community", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, title, content, imageUrls: images }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok && d.ok) router.replace(`/community/${d.id}`);
    else setErr("등록에 실패했어요.");
  }

  return (
    <div className="space-y-4">
      {/* 카테고리 */}
      <div className="flex gap-2">
        {COMMUNITY_CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setCategory(c.key)}
            className={`rounded-full px-3.5 py-2 text-[13px] font-bold ${
              category === c.key ? "bg-forest text-white" : "border border-stone-200 bg-white text-ink"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={100}
        placeholder="제목"
        className="input"
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={7}
        placeholder="내용을 입력하세요. 맛집 추천/질문/후기 자유롭게!"
        className="input min-h-[160px] resize-none"
      />
      <div className="-mt-1 flex items-start gap-2.5 rounded-xl bg-stone-50 p-3">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-forest" />
        <div className="text-[12.5px] leading-relaxed">
          <p className="font-bold text-ink">특정 가게 저격은 금지예요</p>
          <p className="mt-0.5 text-stone-500">
            가게 언급은 <b className="text-ink-muted">맛집 카드</b>로, 좋고 나쁨은 그 가게의{" "}
            <b className="text-ink-muted">정직 후기</b>로 남겨주세요.
          </p>
        </div>
      </div>

      {/* 첨부 미리보기 */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((url) => (
            <div key={url} className="relative h-20 w-20 overflow-hidden rounded-xl bg-stone-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => setImages((prev) => prev.filter((u) => u !== url))}
                className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 첨부 버튼 */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => imgInput.current?.click()}
          disabled={images.length >= 10}
          className="flex items-center gap-1.5 rounded-xl border border-stone-200 px-3 py-2 text-[13px] font-semibold text-ink disabled:opacity-40"
        >
          <ImagePlus size={16} /> 사진
        </button>
        {uploading && <Loader2 size={18} className="animate-spin text-forest" />}
      </div>
      <input ref={imgInput} type="file" accept="image/*" multiple hidden onChange={(e) => onPickImages(e.target.files)} />

      {err && <p className="text-sm text-coral-dark">{err}</p>}
      <button onClick={submit} disabled={busy || uploading} className="btn-primary h-12 w-full !text-base disabled:opacity-50">
        {busy ? "등록 중…" : "등록하기"}
      </button>
    </div>
  );
}
