import Link from "next/link";
import { Pencil, Heart, MessageCircle } from "lucide-react";
import { getSessionUserId } from "@/lib/auth";
import { listCommunityPosts, COMMUNITY_CATEGORIES, categoryLabel } from "@/server/community/CommunityService";
import OfficialBadge from "@/components/OfficialBadge";

export const dynamic = "force-dynamic";

function ago(d: Date): string {
  const s = Math.max(0, (Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "방금";
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return `${Math.floor(s / 86400)}일 전`;
}

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const cat = sp.cat && COMMUNITY_CATEGORIES.some((c) => c.key === sp.cat) ? sp.cat : null;
  const viewerId = await getSessionUserId();
  const posts = await listCommunityPosts(viewerId, cat);

  return (
    <main className="px-5 pb-24 pt-5">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-xl font-black text-ink">커뮤니티</h1>
      </div>

      {/* 카테고리 탭 */}
      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
        <CatChip label="전체" href="/community" active={!cat} />
        {COMMUNITY_CATEGORIES.map((c) => (
          <CatChip key={c.key} label={c.label} href={`/community?cat=${c.key}`} active={cat === c.key} />
        ))}
      </div>

      {posts.length === 0 ? (
        <p className="mt-10 rounded-2xl bg-stone-50 py-12 text-center text-sm text-stone-400">
          아직 글이 없어요. 첫 글을 남겨보세요!
        </p>
      ) : (
        <ul className="space-y-3">
          {posts.map((p) => (
            <li key={p.id}>
              <Link href={`/community/${p.id}`} className="flex gap-3 rounded-2xl border border-stone-200 bg-white p-3.5 active:bg-stone-50">
                {p.thumb && (
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-stone-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.thumb} alt="" className="h-full w-full object-cover" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <span className="inline-block rounded-md bg-forest-soft px-1.5 py-0.5 text-[11px] font-bold text-forest">
                    {categoryLabel(p.category)}
                  </span>
                  <div className="mt-1 truncate text-[15px] font-bold text-ink">{p.title}</div>
                  <div className="line-clamp-1 text-[13px] text-ink-muted">{p.excerpt}</div>
                  <div className="mt-1.5 flex items-center gap-2 text-[11px] text-stone-400">
                    <span className="flex items-center gap-0.5 font-semibold text-ink-muted">
                      {p.author.nickname}
                      {p.author.isAdmin && <OfficialBadge size={11} />}
                    </span>
                    <span>· {ago(p.createdAt)}</span>
                    <span className="ml-auto flex items-center gap-2">
                      <span className="flex items-center gap-0.5"><Heart size={11} /> {p.likeCount}</span>
                      <span className="flex items-center gap-0.5"><MessageCircle size={11} /> {p.commentCount}</span>
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* 글쓰기 FAB */}
      <Link
        href="/community/write"
        aria-label="글쓰기"
        className="fixed bottom-[88px] right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-forest text-white shadow-[0_8px_24px_rgba(31,77,63,.4)] active:scale-95"
      >
        <Pencil size={24} strokeWidth={2.4} />
      </Link>
    </main>
  );
}

function CatChip({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`shrink-0 rounded-full px-3.5 py-2 text-[13px] font-bold ${
        active ? "bg-forest text-white" : "border border-stone-200 bg-white text-ink"
      }`}
    >
      {label}
    </Link>
  );
}
