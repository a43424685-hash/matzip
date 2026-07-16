"use client";

import { useState } from "react";
import { toast } from "@/components/AppDialogs";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { MapPin, Check, X, Search } from "lucide-react";
import OfficialBadge from "@/components/OfficialBadge";
import ReportButton from "@/components/ReportButton";
import { containsProfanity } from "@/lib/profanity";

type AttachResult = { name: string; address: string | null; kakaoPlaceId: string | null; lat: number | null; lng: number | null };

type Attach = AttachResult & { registeredPostId: string | null };

type Comment = {
  id: string;
  content: string;
  isAccepted: boolean;
  createdAt: string;
  userId: string;
  user: { id: string; nickname: string; avatarUrl: string | null; isAdmin: boolean };
  attach: Attach | null;
};

export default function CommunityComments({
  postId,
  initial,
  isLoggedIn,
  isPostAuthor,
  viewerId,
}: {
  postId: string;
  initial: Comment[];
  isLoggedIn: boolean;
  isPostAuthor: boolean;
  viewerId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [attach, setAttach] = useState<AttachResult | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<AttachResult[]>([]);

  function requireLogin(): boolean {
    if (!isLoggedIn) {
      router.push(`/login?returnTo=${encodeURIComponent(pathname)}`);
      return false;
    }
    return true;
  }

  async function searchAttach(query: string) {
    setQ(query);
    if (query.trim().length < 1) {
      setResults([]);
      return;
    }
    // 카카오 전체 검색(등록 안 된 가게도 나옴)
    const r = await fetch(`/api/places/search?q=${encodeURIComponent(query)}`);
    if (r.ok) {
      const data = await r.json();
      setResults(
        (data.results ?? []).map((p: { name: string; address: string; kakaoPlaceId: string | null; latitude: number; longitude: number }) => ({
          name: p.name,
          address: p.address,
          kakaoPlaceId: p.kakaoPlaceId,
          lat: p.latitude,
          lng: p.longitude,
        }))
      );
    }
  }

  async function submit() {
    if (!requireLogin()) return;
    const content = text.trim();
    if (!content || busy) return;
    if (containsProfanity(content)) {
      toast("욕설·비속어는 쓸 수 없어요.", "error");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`/api/community/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, place: attach }),
      });
      if (r.ok) {
        setText("");
        setAttach(null);
        router.refresh();
      } else {
        const d = await r.json().catch(() => ({}));
        toast(d.reason || d.error || "댓글 등록에 실패했어요.", "error");
      }
    } catch {
      toast("네트워크 오류로 등록하지 못했어요.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function accept(commentId: string) {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/community/${postId}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId }),
      });
      if (r.ok) router.refresh();
      else toast("채택에 실패했어요.", "error");
    } catch {
      toast("네트워크 오류로 처리하지 못했어요.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="space-y-4">
        {initial.length === 0 ? (
          <p className="py-4 text-center text-[13px] text-stone-400">첫 댓글을 남겨보세요.</p>
        ) : (
          initial.map((c) => (
            <div key={c.id} className={`rounded-2xl p-0.5 ${c.isAccepted ? "bg-forest-soft/40" : ""}`}>
              <div className="flex gap-2.5 p-2">
                <Link href={`/u/${c.user.id}`} className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-forest-soft text-[13px] font-bold text-forest">
                  {c.user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.user.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    c.user.nickname.slice(0, 1)
                  )}
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Link href={`/u/${c.user.id}`} className="flex items-center gap-1 text-[13px] font-bold text-ink">
                      {c.user.nickname}
                      {c.user.isAdmin && <OfficialBadge size={12} />}
                    </Link>
                    {c.isAccepted && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-forest px-1.5 py-0.5 text-[10px] font-bold text-white">
                        <Check size={10} strokeWidth={3} /> 채택
                      </span>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap break-words text-[14px] text-ink">{c.content}</p>

                  {/* 첨부된 맛집 카드 (등록됐으면 우리 글로, 아니면 등록 유도) */}
                  {c.attach && (
                    <Link
                      href={
                        c.attach.registeredPostId
                          ? `/restaurants/${c.attach.registeredPostId}`
                          : registerHref(c.attach)
                      }
                      className="mt-1.5 flex items-center gap-2 rounded-xl border border-stone-200 bg-white p-2"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-forest-soft">
                        <MapPin size={16} className="text-forest" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-bold text-ink">{c.attach.name}</div>
                        <div className="truncate text-[11px] text-stone-400">
                          {c.attach.registeredPostId ? "맛집 보기" : "아직 등록 안 됨 · 등록하기"}
                          {c.attach.address ? ` · ${c.attach.address}` : ""}
                        </div>
                      </div>
                    </Link>
                  )}

                  {/* 액션: 채택(질문자) / 신고(타인) */}
                  <div className="mt-1 flex items-center gap-3 text-[12px]">
                    {isPostAuthor && !c.isAccepted && c.userId !== viewerId && (
                      <button type="button" onClick={() => accept(c.id)} disabled={busy} className="font-bold text-forest">
                        채택하기
                      </button>
                    )}
                    {viewerId && c.userId !== viewerId && (
                      <ReportButton targetType="community_comment" targetId={c.id} className="flex items-center gap-0.5 text-stone-400" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 첨부 미리보기 */}
      {attach && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-forest/30 bg-forest-soft/20 p-2">
          <MapPin size={15} className="shrink-0 text-forest" />
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{attach.name}</span>
          <button type="button" onClick={() => setAttach(null)} className="shrink-0 text-stone-400">
            <X size={15} />
          </button>
        </div>
      )}

      {/* 입력 */}
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (!requireLogin()) return;
            setPickerOpen(true);
          }}
          className="flex shrink-0 items-center gap-1 rounded-full border border-stone-200 px-3 py-2.5 text-[12px] font-bold text-forest"
        >
          <MapPin size={14} /> 맛집
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="댓글 달기…"
          className="min-w-0 flex-1 rounded-full bg-stone-100 px-4 py-2.5 text-[14px] outline-none"
        />
        <button onClick={submit} disabled={busy || !text.trim()} className="shrink-0 rounded-full bg-forest px-4 py-2.5 text-[13px] font-bold text-white disabled:opacity-40">
          등록
        </button>
      </div>

      {/* 맛집 첨부 검색 시트 */}
      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setPickerOpen(false)}>
          <div className="max-h-[70dvh] w-full max-w-md overflow-hidden rounded-t-2xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-base font-bold text-ink">맛집 첨부</h3>
            <div className="flex h-11 items-center gap-2 rounded-full bg-stone-100 px-4">
              <Search size={16} className="text-stone-400" />
              <input
                autoFocus
                value={q}
                onChange={(e) => searchAttach(e.target.value)}
                placeholder="등록된 맛집 이름 검색"
                className="min-w-0 flex-1 bg-transparent text-[14px] outline-none"
              />
            </div>
            <div className="mt-3 max-h-[45dvh] space-y-1 overflow-y-auto">
              {results.length === 0 ? (
                <p className="py-6 text-center text-[13px] text-stone-400">검색어를 입력하세요.</p>
              ) : (
                results.map((r) => (
                  <button
                    key={(r.kakaoPlaceId ?? r.name) + (r.address ?? "")}
                    type="button"
                    onClick={() => {
                      setAttach(r);
                      setPickerOpen(false);
                      setQ("");
                      setResults([]);
                    }}
                    className="flex w-full items-center gap-2 rounded-xl p-2 text-left active:bg-stone-50"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-forest-soft">
                      <MapPin size={16} className="text-forest" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-bold text-ink">{r.name}</div>
                      <div className="truncate text-[12px] text-stone-400">{r.address}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
            <button type="button" onClick={() => setPickerOpen(false)} className="mt-3 w-full py-2 text-[14px] text-stone-400">
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// 미등록 첨부 가게 → 카카오 정보로 등록 화면 프리필
function registerHref(a: Attach): string {
  const p = new URLSearchParams();
  p.set("name", a.name);
  if (a.address) p.set("address", a.address);
  if (a.kakaoPlaceId) p.set("kakaoId", a.kakaoPlaceId);
  if (a.lat != null) p.set("lat", String(a.lat));
  if (a.lng != null) p.set("lng", String(a.lng));
  return `/register?${p.toString()}`;
}
