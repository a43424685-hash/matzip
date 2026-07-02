import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import {
  getCommunityPost,
  listCommunityComments,
  categoryLabel,
} from "@/server/community/CommunityService";
import OfficialBadge from "@/components/OfficialBadge";
import CardImage from "@/components/CardImage";
import DetailBackButton from "@/components/DetailBackButton";
import DetailOverflowMenu from "@/components/DetailOverflowMenu";
import BlockButton from "@/components/BlockButton";
import ReportButton from "@/components/ReportButton";
import CommunityLikeButton from "@/components/community/CommunityLikeButton";
import CommunityComments from "@/components/community/CommunityComments";
import CommunityDeleteButton from "@/components/community/CommunityDeleteButton";
import CommunityBlindButton from "@/components/community/CommunityBlindButton";

export const dynamic = "force-dynamic";

const MENU_ROW = "flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13.5px] font-medium text-ink hover:bg-stone-50";

function ymd(d: Date) {
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export default async function CommunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const data = await getCommunityPost(id, user?.id ?? null);
  if (!data) notFound();
  const { post, liked } = data;
  const comments = await listCommunityComments(id);
  const isAuthor = user?.id === post.userId;

  const hasMenu = isAuthor || !!user;
  const menuItems = (
    <>
      {isAuthor && <CommunityDeleteButton postId={post.id} />}
      {!isAuthor && user && (
        <>
          <ReportButton targetType="community_post" targetId={post.id} className={MENU_ROW} />
          <BlockButton userId={post.userId} nickname={post.user.nickname} className={`${MENU_ROW} text-coral-dark`} />
        </>
      )}
      {user?.isAdmin && <CommunityBlindButton postId={post.id} blinded={!!post.blindedAt} />}
      {user?.isAdmin && !isAuthor && <CommunityDeleteButton postId={post.id} label="운영자 삭제" />}
    </>
  );

  return (
    <main className="px-5 pb-24 pt-5">
      <header className="mb-4 flex items-center justify-between">
        <DetailBackButton />
        {hasMenu && <DetailOverflowMenu>{menuItems}</DetailOverflowMenu>}
      </header>

      {post.blindedAt && (
        <div className="mb-3 rounded-2xl bg-coral/10 p-3 text-[13px] leading-relaxed text-coral-dark">
          신고 누적으로 <b>임시 블라인드</b>된 글이에요. 이의가 있으면 고객센터로 문의해주세요. (작성자·운영자만 보여요)
        </div>
      )}

      <span className="inline-block rounded-md bg-forest-soft px-2 py-0.5 text-[12px] font-bold text-forest">
        {categoryLabel(post.category)}
      </span>
      <h1 className="mt-2 text-[21px] font-extrabold leading-snug text-ink">{post.title}</h1>

      {/* 작성자 → 프로필 */}
      <Link href={`/u/${post.user.id}`} className="mt-3 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-forest-soft text-[14px] font-bold text-forest">
          {post.user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.user.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            post.user.nickname.slice(0, 1)
          )}
        </span>
        <span>
          <span className="flex items-center gap-1 text-[14px] font-bold text-ink">
            {post.user.nickname}
            {post.user.isAdmin && <OfficialBadge size={13} />}
          </span>
          <span className="text-[12px] text-stone-400">Lv.{post.user.totalLevel} · {ymd(post.createdAt)}</span>
        </span>
      </Link>

      {/* 본문 */}
      <p className="mt-4 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink">{post.content}</p>

      {/* 사진 */}
      {post.imageUrls.length > 0 && (
        <div className="mt-4 space-y-2">
          {post.imageUrls.map((url) => (
            <CardImage key={url} src={url} alt="" label="" className="w-full rounded-2xl" />
          ))}
        </div>
      )}

      {/* 좋아요 */}
      <div className="mt-5">
        <CommunityLikeButton postId={post.id} initialLiked={liked} initialCount={post.likeCount} isLoggedIn={!!user} />
      </div>

      {/* 댓글 */}
      <section className="mt-6 border-t border-stone-100 pt-5">
        <h2 className="mb-3 text-sm font-extrabold text-ink">댓글 {post.commentCount}</h2>
        <CommunityComments
          postId={post.id}
          initial={comments.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() }))}
          isLoggedIn={!!user}
          isPostAuthor={isAuthor}
          viewerId={user?.id ?? null}
        />
      </section>

      <p className="mt-4 flex items-center gap-3 text-[13px] text-stone-400">
        {user && !isAuthor && <span className="text-stone-400">부적절한 글은 우측 상단 ⋯에서 차단할 수 있어요.</span>}
      </p>
    </main>
  );
}
