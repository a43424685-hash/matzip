"use client";

import { useState } from "react";
import { MessageCircle, Heart, Pin, Trash2 } from "lucide-react";
import ReportButton from "./ReportButton";
import BlockButton from "./BlockButton";
import OfficialBadge from "./OfficialBadge";

interface CUser {
  id: string;
  nickname: string;
  level: number;
  avatarUrl: string | null;
  isOfficial: boolean;
}
export interface CNode {
  id: string;
  content: string;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
  isPinned: boolean;
  isMine: boolean;
  user: CUser;
  replies: CNode[];
}

function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "방금";
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return `${Math.floor(s / 86400)}일 전`;
}

function toggleLikeIn(nodes: CNode[], id: string): CNode[] {
  const flip = (n: CNode): CNode =>
    n.id === id
      ? { ...n, likedByMe: !n.likedByMe, likeCount: n.likeCount + (n.likedByMe ? -1 : 1) }
      : { ...n, replies: toggleLikeIn(n.replies, id) };
  return nodes.map(flip);
}

// 입력칸이 매 렌더마다 재생성되지 않도록 아이템을 모듈 최상위 컴포넌트로 둔다(키보드 닫힘 방지).
interface Ctx {
  isLoggedIn: boolean;
  isPostAuthor: boolean;
  replyTo: string | null;
  setReplyTo: (v: string | null) => void;
  replyText: string;
  setReplyText: (v: string) => void;
  busy: boolean;
  like: (id: string) => void;
  pin: (id: string) => void;
  del: (id: string) => void;
  submit: (content: string, parentId: string | null) => void;
}

function CommentItem({ c, depth, ctx }: { c: CNode; depth: number; ctx: Ctx }) {
  return (
    <div>
      <div className="flex gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forest-soft text-xs font-bold text-forest">
          {c.user.nickname.slice(0, 1)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[12px]">
            <b className="text-ink">{c.user.nickname}</b>
            {c.user.isOfficial && <OfficialBadge size={14} />}
            <span className="text-stone-400">Lv.{c.user.level}</span>
            <span className="text-stone-300">· {ago(c.createdAt)}</span>
            {c.isPinned && (
              <span className="flex items-center gap-0.5 rounded-full bg-forest-soft px-1.5 py-0.5 text-[10px] font-bold text-forest">
                <Pin size={9} /> 고정
              </span>
            )}
          </div>
          <p className="mt-0.5 whitespace-pre-line break-words text-sm text-ink">{c.content}</p>
          <div className="mt-1 flex items-center gap-3 text-[12px] text-stone-400">
            <button
              onClick={() => ctx.like(c.id)}
              disabled={!ctx.isLoggedIn}
              className={`flex items-center gap-1 ${c.likedByMe ? "font-semibold text-coral" : ""}`}
            >
              <Heart size={13} fill={c.likedByMe ? "currentColor" : "none"} />
              {c.likeCount > 0 ? c.likeCount : ""}
            </button>
            {ctx.isLoggedIn && (
              <button onClick={() => ctx.setReplyTo(ctx.replyTo === c.id ? null : c.id)}>답글</button>
            )}
            {depth === 0 && ctx.isPostAuthor && (
              <button onClick={() => ctx.pin(c.id)} className="flex items-center gap-0.5">
                <Pin size={12} /> {c.isPinned ? "고정 해제" : "고정"}
              </button>
            )}
            {c.isMine && (
              <button onClick={() => ctx.del(c.id)} className="flex items-center gap-0.5 text-stone-400">
                <Trash2 size={12} /> 삭제
              </button>
            )}
            {ctx.isLoggedIn && !c.isMine && (
              <ReportButton
                targetType="comment"
                targetId={c.id}
                className="flex items-center gap-0.5 text-stone-400"
              />
            )}
            {ctx.isLoggedIn && !c.isMine && (
              <BlockButton
                userId={c.user.id}
                nickname={c.user.nickname}
                className="flex items-center gap-0.5 text-stone-400"
              />
            )}
          </div>

          {ctx.replyTo === c.id && (
            <div className="mt-2 flex gap-1.5">
              <input
                value={ctx.replyText}
                onChange={(e) => ctx.setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    ctx.submit(ctx.replyText, c.id);
                  }
                }}
                placeholder={`@${c.user.nickname} 에게 답글`}
                autoFocus
                className="input h-9 flex-1 !text-sm"
              />
              <button
                onClick={() => ctx.submit(ctx.replyText, c.id)}
                disabled={ctx.busy || !ctx.replyText.trim()}
                className="btn-primary h-9 px-3 !text-sm"
              >
                등록
              </button>
            </div>
          )}
        </div>
      </div>

      {c.replies.length > 0 && (
        <div className={depth < 4 ? "ml-4 mt-2.5 space-y-3 border-l border-stone-100 pl-2.5" : "mt-2.5 space-y-3"}>
          {c.replies.map((r) => (
            <CommentItem key={r.id} c={r} depth={depth + 1} ctx={ctx} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Comments({
  postId,
  initial,
  initialCount,
  isLoggedIn,
  isPostAuthor,
}: {
  postId: string;
  initial: CNode[];
  initialCount: number;
  isLoggedIn: boolean;
  isPostAuthor: boolean;
}) {
  const [nodes, setNodes] = useState<CNode[]>(initial);
  const [count, setCount] = useState(initialCount);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function reload() {
    const r = await fetch(`/api/posts/${postId}/comments`);
    if (r.ok) setNodes((await r.json()).comments);
  }

  async function submit(content: string, parentId: string | null) {
    if (!content.trim() || busy) return;
    setBusy(true);
    setErr("");
    const r = await fetch(`/api/posts/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: content.trim(), parentId }),
    });
    setBusy(false);
    const d = await r.json().catch(() => ({}));
    if (r.ok && d.ok) {
      setText("");
      setReplyText("");
      setReplyTo(null);
      setCount((c) => c + 1);
      await reload();
    } else {
      setErr(d.reason || "댓글 작성에 실패했어요.");
    }
  }

  async function like(id: string) {
    setNodes((ns) => toggleLikeIn(ns, id));
    await fetch(`/api/comments/${id}/like`, { method: "POST" }).catch(() => {});
  }
  async function pin(id: string) {
    await fetch(`/api/comments/${id}/pin`, { method: "POST" });
    await reload();
  }
  async function del(id: string) {
    if (!confirm("이 댓글을 삭제할까요?")) return;
    const r = await fetch(`/api/comments/${id}`, { method: "DELETE" });
    const d = await r.json().catch(() => ({}));
    if (r.ok && d.ok) {
      setCount((c) => Math.max(0, c - (d.deleted || 1)));
      await reload();
    }
  }

  const ctx: Ctx = {
    isLoggedIn,
    isPostAuthor,
    replyTo,
    setReplyTo,
    replyText,
    setReplyText,
    busy,
    like,
    pin,
    del,
    submit,
  };

  return (
    <section className="border-t border-stone-100 pt-5">
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-extrabold text-ink">
        <MessageCircle size={16} /> 댓글 {count}
      </h3>

      {isLoggedIn ? (
        <div className="mb-4 flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit(text, null);
              }
            }}
            placeholder="댓글을 남겨보세요"
            className="input h-11 flex-1"
          />
          <button
            onClick={() => submit(text, null)}
            disabled={busy || !text.trim()}
            className="btn-primary h-11 px-4"
          >
            등록
          </button>
        </div>
      ) : (
        <a href="/login" className="mb-4 block text-sm font-semibold text-forest">
          로그인하고 댓글 달기
        </a>
      )}
      {err && <p className="mb-3 text-[13px] text-coral-dark">{err}</p>}

      {nodes.length === 0 ? (
        <p className="py-4 text-center text-sm text-stone-400">첫 댓글을 남겨보세요.</p>
      ) : (
        <div className="space-y-4">
          {nodes.map((c) => (
            <CommentItem key={c.id} c={c} depth={0} ctx={ctx} />
          ))}
        </div>
      )}
    </section>
  );
}
