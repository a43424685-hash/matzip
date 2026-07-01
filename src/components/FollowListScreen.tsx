import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { FollowUserRow } from "@/server/follow/FollowService";
import FollowButton from "@/components/FollowButton";
import OfficialBadge from "@/components/OfficialBadge";

/** 팔로워/팔로잉 목록 화면. 맞팔 버튼 포함. /u/[id] 프로필로 뒤로가기. */
export default function FollowListScreen({
  targetUserId,
  targetNickname,
  tab,
  rows,
  viewerId,
}: {
  targetUserId: string;
  targetNickname: string;
  tab: "followers" | "following";
  rows: FollowUserRow[];
  viewerId: string | null;
}) {
  return (
    <main className="px-5 pb-24 pt-5">
      <header className="relative mb-3 flex h-10 items-center justify-center">
        <Link
          href={`/u/${targetUserId}`}
          aria-label="뒤로"
          className="absolute left-0 flex h-10 w-10 items-center justify-center rounded-full text-ink active:scale-95"
        >
          <ArrowLeft size={22} strokeWidth={2.2} />
        </Link>
        <h1 className="max-w-[60%] truncate text-lg font-extrabold text-ink">{targetNickname}</h1>
      </header>

      {/* 탭 */}
      <div className="mb-4 grid grid-cols-2 rounded-full bg-stone-100 p-1 text-[14px] font-bold">
        <Link
          href={`/u/${targetUserId}/followers`}
          className={`rounded-full py-2 text-center ${tab === "followers" ? "bg-white text-ink shadow-sm" : "text-stone-400"}`}
        >
          팔로워
        </Link>
        <Link
          href={`/u/${targetUserId}/following`}
          className={`rounded-full py-2 text-center ${tab === "following" ? "bg-white text-ink shadow-sm" : "text-stone-400"}`}
        >
          팔로잉
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="mt-10 rounded-2xl bg-stone-50 py-12 text-center text-sm text-stone-400">
          {tab === "followers" ? "아직 팔로워가 없어요." : "아직 팔로우한 사람이 없어요."}
        </p>
      ) : (
        <ul className="space-y-1">
          {rows.map((u) => (
            <li key={u.id} className="flex items-center gap-3 py-2">
              <Link href={`/u/${u.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-forest-soft text-base font-extrabold text-forest">
                  {u.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={u.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    u.nickname.slice(0, 1)
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1 truncate text-[15px] font-bold text-ink">
                    {u.nickname}
                    {u.isAdmin && <OfficialBadge size={13} />}
                  </div>
                  <div className="text-[12px] text-stone-400">Lv.{u.totalLevel}</div>
                </div>
              </Link>
              {viewerId && viewerId !== u.id && (
                <FollowButton targetId={u.id} initialFollowing={u.viewerFollows} />
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
