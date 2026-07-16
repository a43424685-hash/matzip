"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check } from "lucide-react";
import { uploadImage } from "@/lib/imageUpload";
import { updateProfileAction, type ProfileState } from "@/app/actions/account";

export default function ProfileEditForm({
  initialNickname,
  initialAvatar,
}: {
  initialNickname: string;
  initialAvatar: string | null;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ProfileState, FormData>(
    updateProfileAction,
    undefined
  );
  const [nickname, setNickname] = useState(initialNickname);
  const [avatar, setAvatar] = useState(initialAvatar ?? "");
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  async function onPick(file?: File) {
    if (!file) return;
    setUploading(true);
    setErr("");
    try {
      const { url, thumbnailUrl } = await uploadImage(file, "avatar");
      setAvatar(thumbnailUrl || url);
    } catch {
      setErr("사진 업로드에 실패했어요.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form action={action} className="mt-6 space-y-6">
      {/* 아바타 */}
      <div className="flex flex-col items-center gap-3">
        <div className="h-24 w-24 overflow-hidden rounded-full bg-forest-soft text-forest">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="프로필" className="h-24 w-24 object-cover" />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center text-3xl font-extrabold">
              {nickname.slice(0, 1)}
            </div>
          )}
        </div>
        <label className="cursor-pointer text-sm font-semibold text-forest">
          <span className="flex items-center gap-1">
            <Camera size={15} /> {uploading ? "업로드 중…" : "사진 변경"}
          </span>
          <input
            type="file"
            accept="image/*"
            disabled={uploading}
            onChange={(e) => onPick(e.target.files?.[0])}
            className="hidden"
          />
        </label>
        {avatar && (
          <button type="button" onClick={() => setAvatar("")} className="text-[12px] text-stone-400">
            기본 이미지로
          </button>
        )}
        {err && <p className="text-[12px] text-coral-dark">{err}</p>}
        <input type="hidden" name="avatarUrl" value={avatar} />
      </div>

      {/* 닉네임 */}
      <div>
        <label className="label">닉네임</label>
        <input
          name="nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          className="input h-12"
          maxLength={12}
        />
        <p className="mt-1 text-[12px] text-stone-400">닉네임은 30일에 한 번만 바꿀 수 있어요.</p>
      </div>

      {state?.error && <p className="text-sm text-coral-dark">{state.error}</p>}
      {state?.ok && (
        <p className="flex items-center gap-1 text-sm font-semibold text-forest">
          <Check size={16} /> 저장됐어요.
        </p>
      )}

      <button type="submit" disabled={pending || uploading} className="btn-primary h-12 w-full !text-base">
        {pending ? "저장 중…" : "저장"}
      </button>
    </form>
  );
}
