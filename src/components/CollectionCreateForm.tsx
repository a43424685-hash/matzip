"use client";

import { useActionState } from "react";
import { Globe, Lock } from "lucide-react";
import { createCollectionAction, type CollectionState } from "@/app/actions/collection";

export default function CollectionCreateForm({
  regions,
}: {
  regions: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<CollectionState, FormData>(
    createCollectionAction,
    undefined
  );

  return (
    <form action={action} className="space-y-5">
      <div>
        <label className="label">리스트 제목 *</label>
        <input
          name="title"
          required
          maxLength={40}
          className="input h-12"
          placeholder="예) 내 성수 데이트 맛집"
        />
      </div>

      <div>
        <label className="label">설명 (선택)</label>
        <textarea
          name="description"
          rows={2}
          maxLength={200}
          className="input"
          placeholder="어떤 리스트인지 한 줄로 소개해보세요."
        />
      </div>

      <div>
        <label className="label">대표 지역 *</label>
        <select name="regionId" required className="input h-12" defaultValue="">
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

      <div>
        <label className="label">공개 범위</label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-white py-3 text-sm font-semibold text-ink has-[:checked]:border-forest has-[:checked]:bg-forest has-[:checked]:text-white">
            <input type="radio" name="isPublic" value="true" defaultChecked className="sr-only" />
            <Globe size={16} /> 공개
          </label>
          <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-white py-3 text-sm font-semibold text-ink has-[:checked]:border-forest has-[:checked]:bg-forest has-[:checked]:text-white">
            <input type="radio" name="isPublic" value="false" className="sr-only" />
            <Lock size={16} /> 비공개
          </label>
        </div>
      </div>

      {state?.error && <p className="text-sm text-coral-dark">{state.error}</p>}

      <button type="submit" disabled={pending} className="btn-primary h-12 w-full !text-base">
        {pending ? "만드는 중…" : "리스트 만들기"}
      </button>
    </form>
  );
}
