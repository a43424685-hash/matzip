"use client";

import { useState } from "react";
import { Share2, Link2, ImageDown, Camera, X } from "lucide-react";

const KAKAO_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;

// 카카오 공유용 전체 SDK (지도 SDK와 별개). 실패하면 링크복사로 폴백.
function loadKakaoSdk(): Promise<any> {
  return new Promise((resolve, reject) => {
    const w = window as unknown as { Kakao?: any };
    if (w.Kakao?.isInitialized?.()) return resolve(w.Kakao);
    const init = () => {
      try {
        if (!w.Kakao.isInitialized()) w.Kakao.init(KAKAO_KEY);
        resolve(w.Kakao);
      } catch (e) {
        reject(e);
      }
    };
    if (w.Kakao) return init();
    if (!KAKAO_KEY || KAKAO_KEY.startsWith("여기에")) return reject(new Error("NO_KEY"));
    const s = document.createElement("script");
    s.src = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js";
    s.crossOrigin = "anonymous";
    s.onload = init;
    s.onerror = () => reject(new Error("SDK_FAIL"));
    document.head.appendChild(s);
  });
}

export default function ShareSheet({
  postId,
  restaurantName,
  imageUrl,
}: {
  postId: string;
  restaurantName: string;
  imageUrl: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState("");

  const shareUrl = () => `${window.location.origin}/share/${postId}`;
  const record = () => {
    fetch(`/api/posts/${postId}/share`, { method: "POST" }).catch(() => {});
  };
  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 2200);
  };

  async function copyLink(msg = "링크를 복사했어요") {
    try {
      await navigator.clipboard.writeText(shareUrl());
      flash(msg);
    } catch {
      flash("복사에 실패했어요");
    }
  }

  async function onKakao() {
    record();
    try {
      const Kakao = await loadKakaoSdk();
      Kakao.Share.sendDefault({
        objectType: "feed",
        content: {
          title: `${restaurantName} · 먹고핀`,
          description: "먹고핀에서 발견한 맛집",
          imageUrl: imageUrl || `${window.location.origin}/icon.svg`,
          link: { mobileWebUrl: shareUrl(), webUrl: shareUrl() },
        },
        buttons: [{ title: "맛집 보기", link: { mobileWebUrl: shareUrl(), webUrl: shareUrl() } }],
      });
      setOpen(false);
    } catch {
      copyLink("카카오 공유가 안 돼 링크를 복사했어요");
    }
  }

  async function onInsta() {
    record();
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ title: restaurantName, url: shareUrl() });
        setOpen(false);
        return;
      } catch {
        /* 사용자가 취소했거나 미지원 */
      }
    }
    copyLink("링크 복사됨 — 인스타 스토리에 붙여넣어 공유하세요");
  }

  async function onSaveImage() {
    record();
    if (!imageUrl) {
      window.open(shareUrl(), "_blank");
      return;
    }
    try {
      const r = await fetch(imageUrl);
      const b = await r.blob();
      const u = URL.createObjectURL(b);
      const a = document.createElement("a");
      a.href = u;
      a.download = `${restaurantName}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(u);
      flash("이미지를 저장했어요");
    } catch {
      window.open(imageUrl, "_blank");
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-outline h-10 w-full !text-sm">
        <Share2 size={15} /> 공유
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-stone-200" />
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-base font-extrabold text-ink">공유하기</h3>
              <button onClick={() => setOpen(false)} className="text-stone-400" aria-label="닫기">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-0.5">
              <ShareRow
                onClick={onKakao}
                icon={<span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FEE500] text-[15px] font-black text-[#3c1e1e]">k</span>}
                label="카카오톡으로 공유"
              />
              <ShareRow
                onClick={onInsta}
                icon={<span className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-ink"><Camera size={18} strokeWidth={1.8} /></span>}
                label="인스타 스토리로 공유"
              />
              <ShareRow
                onClick={() => copyLink()}
                icon={<span className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-ink"><Link2 size={18} strokeWidth={1.8} /></span>}
                label="링크 복사"
              />
              <ShareRow
                onClick={onSaveImage}
                icon={<span className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-ink"><ImageDown size={18} strokeWidth={1.8} /></span>}
                label="이미지 저장"
              />
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed inset-x-0 bottom-24 z-[80] flex justify-center px-6">
          <div className="rounded-full bg-ink/90 px-4 py-2 text-[13px] font-semibold text-white shadow-lg">{toast}</div>
        </div>
      )}
    </>
  );
}

function ShareRow({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-1.5 py-2.5 text-left text-[15px] font-semibold text-ink active:bg-stone-50"
    >
      {icon}
      {label}
    </button>
  );
}
