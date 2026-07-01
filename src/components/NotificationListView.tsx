import Link from "next/link";
import { Heart, MessageCircle, CornerDownRight, MapPinned, UserPlus } from "lucide-react";
import type { NotificationRow } from "@/server/notification/NotificationService";
import OfficialBadge from "@/components/OfficialBadge";

const LABEL: Record<string, string> = {
  like: "회원님의 글을 좋아해요",
  comment: "회원님의 글에 댓글을 남겼어요",
  reply: "회원님의 댓글에 답글을 남겼어요",
  follow: "회원님을 팔로우했어요",
};

function iconFor(type: string) {
  if (type === "like") return <Heart size={16} className="text-coral" />;
  if (type === "reply") return <CornerDownRight size={16} className="text-forest" />;
  if (type === "map_update") return <MapPinned size={16} className="text-forest" />;
  if (type === "follow") return <UserPlus size={16} className="text-forest" />;
  return <MessageCircle size={16} className="text-forest" />;
}

function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "방금";
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return `${Math.floor(s / 86400)}일 전`;
}

export default function NotificationListView({ rows }: { rows: NotificationRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="mt-10 rounded-2xl bg-stone-50 py-12 text-center text-sm text-stone-400">
        아직 알림이 없어요.
      </p>
    );
  }
  return (
    <ul className="space-y-1.5">
      {rows.map((n) => {
        const isMapUpdate = n.type === "map_update";
        const body = (
          <div
            className={`flex items-start gap-3 rounded-2xl px-4 py-3 ${
              n.read ? "bg-white" : "bg-forest-soft/40"
            }`}
          >
            <span className="mt-0.5 shrink-0">{iconFor(n.type)}</span>
            <div className="min-w-0 flex-1">
              {isMapUpdate ? (
                <p className="text-sm text-ink">
                  구매한 지도에 <b>새 맛집이 추가</b>됐어요
                </p>
              ) : (
                <p className="text-sm text-ink">
                  <b>{n.actorNickname ?? "알 수 없음"}</b>
                  {n.actorIsOfficial && <OfficialBadge size={13} className="mx-0.5 align-middle" />}님이 {LABEL[n.type] ?? "활동했어요"}
                </p>
              )}
              {isMapUpdate
                ? n.collectionTitle && (
                    <p className="mt-0.5 truncate text-[12px] text-stone-400">{n.collectionTitle}</p>
                  )
                : n.restaurantName && (
                    <p className="mt-0.5 truncate text-[12px] text-stone-400">{n.restaurantName}</p>
                  )}
            </div>
            <span className="shrink-0 text-[11px] text-stone-400">{ago(n.createdAt)}</span>
          </div>
        );
        const href = isMapUpdate
          ? n.collectionId
            ? `/collections/${n.collectionId}`
            : null
          : n.type === "follow"
            ? n.actorUserId
              ? `/u/${n.actorUserId}`
              : null
            : n.postId
              ? `/restaurants/${n.postId}`
              : null;
        return <li key={n.id}>{href ? <Link href={href}>{body}</Link> : body}</li>;
      })}
    </ul>
  );
}
