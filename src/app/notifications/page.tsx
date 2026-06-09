import Link from "next/link";
import { redirect } from "next/navigation";
import { Heart, MessageCircle, CornerDownRight, ShieldAlert } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { listNotifications, markAllRead } from "@/server/notification/NotificationService";
import BackHomeHeader from "@/components/BackHomeHeader";

export const dynamic = "force-dynamic";

const LABEL: Record<string, string> = {
  like: "회원님의 글을 좋아해요",
  comment: "회원님의 글에 댓글을 남겼어요",
  reply: "회원님의 댓글에 답글을 남겼어요",
};

function iconFor(type: string) {
  if (type === "like") return <Heart size={16} className="text-coral" />;
  if (type === "reply") return <CornerDownRight size={16} className="text-forest" />;
  return <MessageCircle size={16} className="text-forest" />;
}

function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "방금";
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return `${Math.floor(s / 86400)}일 전`;
}

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const rows = await listNotifications(user.id);
  await markAllRead(user.id); // 목록을 본 뒤 읽음 처리

  return (
    <main className="px-5 py-6">
      <BackHomeHeader title="알림" />

      {user.isAdmin && (
        <Link
          href="/admin"
          className="mb-4 flex items-center gap-2 rounded-2xl border border-coral/30 bg-coral-soft/40 px-4 py-3 text-sm font-semibold text-coral-dark"
        >
          <ShieldAlert size={16} /> 신고함 (운영자)
        </Link>
      )}

      {rows.length === 0 ? (
        <p className="mt-10 rounded-2xl bg-stone-50 py-12 text-center text-sm text-stone-400">
          아직 알림이 없어요.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((n) => {
            const body = (
              <div
                className={`flex items-start gap-3 rounded-2xl px-4 py-3 ${
                  n.read ? "bg-white" : "bg-forest-soft/40"
                }`}
              >
                <span className="mt-0.5 shrink-0">{iconFor(n.type)}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink">
                    <b>{n.actorNickname ?? "알 수 없음"}</b>님이 {LABEL[n.type] ?? "활동했어요"}
                  </p>
                  {n.restaurantName && (
                    <p className="mt-0.5 truncate text-[12px] text-stone-400">{n.restaurantName}</p>
                  )}
                </div>
                <span className="shrink-0 text-[11px] text-stone-400">{ago(n.createdAt)}</span>
              </div>
            );
            return (
              <li key={n.id}>
                {n.postId ? <Link href={`/restaurants/${n.postId}`}>{body}</Link> : body}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
