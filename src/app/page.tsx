import Link from "next/link";
import {
  Bell,
  ChevronRight,
  Bookmark,
  Heart,
  ShieldCheck,
  Trophy,
  ListChecks,
  Play,
  Coins,
  Plus,
  Lock,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getHomeData, type HomeCollection } from "@/server/home";
import { unreadCount } from "@/server/notification/NotificationService";
import type { PostCard } from "@/server/restaurant/RestaurantService";
import type { UserRankRow } from "@/server/ranking/RankingService";
import CardImage from "@/components/CardImage";
import CategoryIconGrid from "@/components/CategoryIconGrid";
import SiteFooter from "@/components/SiteFooter";

export const dynamic = "force-dynamic";

// sticky 카테고리 메뉴 (이름으로 조회 → /search 링크)
const NAV_CATS = ["노포", "야장", "가성비", "데이트", "혼밥", "카페", "술집", "회식", "비 오는 날", "부모님 모시기 좋음"];
// 오늘 뭐 먹지? 추천 칩
const TODAY_CATS = ["비 오는 날", "야장", "혼밥", "데이트", "가성비", "겨울 국물", "카페"];
// 표시용 짧은 라벨
const SHORT: Record<string, string> = { "부모님 모시기 좋음": "부모님", "겨울 국물": "국물" };

function formatPostDate(value: Date | string) {
  const date = new Date(value);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

export default async function HomePage() {
  const user = await getCurrentUser();
  const { weekly, verified, collections, saved, topUsers, categories } = await getHomeData(user?.id);
  const unread = user ? await unreadCount(user.id) : 0;

  const idByName = new Map(categories.map((c) => [c.name, c.id]));
  const navCats = NAV_CATS.map((n) => ({ name: SHORT[n] ?? n, id: idByName.get(n) })).filter(
    (c): c is { name: string; id: string } => !!c.id
  );
  const todayCats = TODAY_CATS.map((n) => ({ name: SHORT[n] ?? n, id: idByName.get(n) })).filter(
    (c): c is { name: string; id: string } => !!c.id
  );

  return (
    <main className="bg-white pb-8">
      {/* 1. 헤더 (스크롤 시 사라짐 — sticky 아님) */}
      <header className="px-5 pt-4">
        <div className="flex items-center justify-between">
          <span className="brand-logo text-[30px] leading-none">
            <span>먹고</span>
            <span className="brand-logo-point">핀</span>
          </span>
          <div className="flex items-center gap-3.5">
            {user ? (
              <Link href="/me" className="rounded-full bg-forest-soft px-2.5 py-1 text-[12px] font-bold text-forest">
                Lv.{user.totalLevel}
              </Link>
            ) : (
              <Link href="/login" className="text-[13px] font-semibold text-forest">
                로그인
              </Link>
            )}
            {user && (
              <Link href="/me/saved" className="text-coral" aria-label="찜한 맛집">
                <Heart size={22} strokeWidth={2} fill="currentColor" />
              </Link>
            )}
            {user ? (
              <Link href="/notifications" className="relative text-stone-500" aria-label="알림">
                <Bell size={22} strokeWidth={1.9} />
                {unread > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-coral px-1 text-[10px] font-bold text-white">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </Link>
            ) : (
              <span className="text-stone-500">
                <Bell size={22} strokeWidth={1.9} />
              </span>
            )}
          </div>
        </div>

        <p className="mt-2 text-[15px] font-extrabold leading-snug text-ink">
          {user ? (
            <>
              <span className="text-forest">{user.nickname}</span>님, 오늘은 어디서 먹고 핀 꽂을까요?
            </>
          ) : (
            <>먹고 핀 꽂고, 나만의 맛집 지도를 키워요 📍</>
          )}
        </p>
      </header>

      <CategoryIconGrid categories={navCats} />

      {/* 섹션 1. 이번 주 인기 맛집 */}
      <SectionHead title="이번 주 인기 맛집" sub="사람들이 많이 저장한 곳" href="/rankings?tab=weekly" />
      {weekly.length === 0 ? (
        <Empty>아직 이번 주 반응이 없어요.</Empty>
      ) : (
        <div className="no-scrollbar flex items-start gap-3 overflow-x-auto px-5 pb-1">
          {photoFirst(weekly).map((p) =>
            p.media ? <PhotoCard key={p.id} post={p} /> : <TextPostCard key={p.id} post={p} />
          )}
        </div>
      )}

      {/* 내가 찜한 맛집 (로그인 + 찜 있을 때만) */}
      {user && saved.length > 0 && (
        <>
          <div className="flex items-end justify-between px-5 pb-3 pt-9">
            <h2 className="section-title flex items-center gap-1.5">
              <Heart size={17} className="text-coral" fill="currentColor" /> 내가 찜한 맛집
            </h2>
            <Link href="/me/saved" className="flex items-center text-[13px] font-semibold text-forest">
              전체 <ChevronRight size={15} />
            </Link>
          </div>
          <div className="no-scrollbar flex items-start gap-3 overflow-x-auto px-5 pb-1">
            {photoFirst(saved).map((p) =>
              p.media ? <PhotoCard key={p.id} post={p} /> : <TextPostCard key={p.id} post={p} />
            )}
          </div>
        </>
      )}

      {/* 섹션 2. 내 주변 인증 맛집 */}
      <SectionHead title="내 주변 인증 맛집" sub="실제 방문이 인증된 진짜 맛집" href="/search" />
      {verified.length === 0 ? (
        <Empty>아직 인증된 맛집이 없어요. 현장에서 위치 인증을 해보세요.</Empty>
      ) : (
        <div className="no-scrollbar flex items-start gap-3 overflow-x-auto px-5 pb-1">
          {photoFirst(verified).map((p) =>
            p.media ? (
              <PhotoCard key={p.id} post={p} showVerified />
            ) : (
              <TextPostCard key={p.id} post={p} showVerified />
            )
          )}
        </div>
      )}

      {/* 섹션 3. 오늘 뭐 먹지? */}
      <div className="px-5 pt-9">
        <h2 className="section-title">오늘 뭐 먹지?</h2>
        <p className="mt-1 text-[13px] text-ink-muted">상황에 맞게 골라보세요</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {todayCats.map((c) => (
            <Link
              key={c.id}
              href={`/search?categoryIds=${c.id}`}
              className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink active:scale-95"
            >
              {c.name}
            </Link>
          ))}
        </div>
      </div>

      {/* 섹션 4. 추천 맛집 리스트 */}
      <SectionHead title="추천 맛집 리스트" sub="사람들이 모은 맛집 묶음" href="/collections" />
      {collections.length === 0 ? (
        <Empty>아직 공개된 리스트가 없어요.</Empty>
      ) : (
        <div className="no-scrollbar flex gap-3 overflow-x-auto px-5 pb-1">
          {collections.map((c) => (
            <CollectionCard key={c.id} c={c} />
          ))}
        </div>
      )}

      {/* 섹션 4-2. 유료 맛집 지도 — 곧 오픈 (블러 티저) */}
      <div className="px-5 pt-9">
        <h2 className="section-title flex items-center gap-1.5">
          <Coins size={17} className="text-forest" /> 유료 맛집 지도
        </h2>
        <p className="mt-1 text-[13px] text-ink-muted">검증된 미식가가 만든 진짜 맛집 지도를 사고팔아요</p>
        <div className="relative mt-3 overflow-hidden rounded-2xl border border-stone-200">
          <div className="no-scrollbar flex gap-3 p-3 blur-[5px]">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[150px] w-[170px] shrink-0 rounded-2xl bg-stone-100">
                <div className="h-[96px] rounded-t-2xl bg-stone-200" />
                <div className="space-y-1.5 p-2.5">
                  <div className="h-3 w-3/4 rounded bg-stone-200" />
                  <div className="h-2.5 w-1/2 rounded bg-stone-100" />
                </div>
              </div>
            ))}
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/45">
            <span className="flex items-center gap-1.5 rounded-full bg-ink/80 px-3.5 py-1.5 text-[13px] font-bold text-white">
              <Lock size={14} /> 곧 오픈
            </span>
            <p className="text-[13px] font-semibold text-ink">Lv.20 달성 시 오픈돼요</p>
          </div>
        </div>
      </div>

      {/* 섹션 5. 맛잘알 랭킹 */}
      <div className="px-5 pt-9">
        <div className="flex items-end justify-between">
          <h2 className="section-title flex items-center gap-1.5">
            <Trophy size={17} className="text-forest" /> 맛잘알 랭킹
          </h2>
          <Link href="/rankings" className="flex items-center text-[13px] font-semibold text-forest">
            전체 <ChevronRight size={15} />
          </Link>
        </div>
        {topUsers.length === 0 ? (
          <Empty>아직 랭킹이 없어요.</Empty>
        ) : (
          <ol className="mt-3 divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200/80">
            {topUsers.map((u) => (
              <RankRow key={u.userId} u={u} />
            ))}
          </ol>
        )}
      </div>

      <SiteFooter />

      {/* 맛집 등록 FAB (홈에서만) */}
      <Link
        href="/register"
        aria-label="맛집 등록"
        className="fixed bottom-[88px] right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-forest text-white shadow-[0_8px_24px_rgba(31,77,63,.4)] active:scale-95"
      >
        <Plus size={28} strokeWidth={2.4} />
      </Link>
    </main>
  );
}

// ── 작은 컴포넌트들 (서버 렌더) ──────────────────────────────

// 사진 있는 글을 앞으로 — 사진 없는 글은 비중을 낮춰 뒤로 민다 (순서는 안정적으로 유지)
function photoFirst(arr: PostCard[]): PostCard[] {
  return [...arr.filter((p) => p.media), ...arr.filter((p) => !p.media)];
}

function SectionHead({ title, sub, href }: { title: string; sub: string; href: string }) {
  return (
    <div className="flex items-end justify-between px-5 pb-3 pt-9">
      <div>
        <h2 className="section-title">{title}</h2>
        <p className="mt-1 text-[13px] text-ink-muted">{sub}</p>
      </div>
      <Link href={href} className="flex items-center text-[13px] font-semibold text-forest">
        더보기 <ChevronRight size={15} />
      </Link>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="mx-5 rounded-2xl bg-stone-50 py-6 text-center text-sm text-stone-400">{children}</p>;
}

function PhotoCard({ post, showVerified }: { post: PostCard; showVerified?: boolean }) {
  const isVideo = post.media?.type === "video";
  // 영상은 포스터(thumbnailUrl)만 사용 — 영상 URL을 <img>에 넣어 깨지는 것 방지
  const img = post.media?.thumbnailUrl || (isVideo ? null : post.media?.url) || null;
  return (
    <Link
      href={`/restaurants/${post.id}`}
      className="flex h-[238px] w-[184px] shrink-0 flex-col rounded-2xl border border-stone-200 bg-white p-2"
    >
      <div className="relative h-[132px] overflow-hidden rounded-xl bg-stone-100">
        {img ? (
          <CardImage src={img} alt={post.restaurantName} label="사진 준비 중" className="h-full w-full object-cover" />
        ) : isVideo ? (
          <div className="h-full w-full bg-stone-800" />
        ) : (
          <div className="thumb-empty h-full w-full" />
        )}
        {isVideo && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white">
              <Play size={16} fill="currentColor" />
            </span>
          </span>
        )}
        {post.isOfficial ? (
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-amber-500/95 px-2 py-0.5 text-[11px] font-bold text-white">
            <ShieldCheck size={11} /> 운영자
          </span>
        ) : showVerified || post.verification.location ? (
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-forest/90 px-2 py-0.5 text-[11px] font-bold text-white">
            <ShieldCheck size={11} /> 인증
          </span>
        ) : null}
      </div>
      <div className="mt-2 line-clamp-2 min-h-[40px] text-sm font-bold leading-tight text-ink">{post.restaurantName}</div>
      <div className="truncate text-[12px] text-stone-400">{post.regionName}</div>
      <div className="truncate text-[11px] text-stone-400">{formatPostDate(post.createdAt)} 등록</div>
      <div className="mt-auto flex items-center gap-2.5 text-[11px] text-stone-400">
        <span className="flex items-center gap-0.5">
          <Bookmark size={11} /> {post.saveCount}
        </span>
        <span className="flex items-center gap-0.5">
          <Heart size={11} /> {post.likeCount}
        </span>
      </div>
    </Link>
  );
}

// 사진 없는 글 — 큰 이미지 placeholder 대신 작고 깔끔한 텍스트 카드
function TextPostCard({ post, showVerified }: { post: PostCard; showVerified?: boolean }) {
  return (
    <Link
      href={`/restaurants/${post.id}`}
      className="flex h-[238px] w-[184px] shrink-0 flex-col rounded-2xl border border-stone-200 bg-white p-2"
    >
      <div className="relative flex h-[132px] flex-col justify-between overflow-hidden rounded-xl bg-forest-soft p-3">
        <div className="absolute inset-0 opacity-60 thumb-empty" />
        {post.isOfficial ? (
          <span className="relative z-[1] inline-flex w-fit items-center gap-1 rounded-full bg-amber-500/95 px-2 py-0.5 text-[11px] font-bold text-white">
            <ShieldCheck size={11} /> 운영자
          </span>
        ) : showVerified || post.verification.location ? (
          <span className="relative z-[1] inline-flex w-fit items-center gap-1 rounded-full bg-forest/90 px-2 py-0.5 text-[11px] font-bold text-white">
            <ShieldCheck size={11} /> 인증
          </span>
        ) : null}
        <div className="relative z-[1] mt-auto">
          <div className="text-[11px] font-bold text-forest">사진 준비 전</div>
          {post.shortReview && (
            <p className="mt-1 line-clamp-2 text-[12px] font-semibold leading-snug text-ink-muted">
              {post.shortReview}
            </p>
          )}
        </div>
      </div>
      <div className="mt-2 line-clamp-2 min-h-[40px] text-sm font-bold leading-tight text-ink">
        {post.restaurantName}
      </div>
      <div className="truncate text-[12px] text-stone-400">{post.regionName}</div>
      <div className="truncate text-[11px] text-stone-400">{formatPostDate(post.createdAt)} 등록</div>
      <div className="mt-auto flex items-center gap-2.5 text-[11px] text-stone-400">
        <span className="flex items-center gap-0.5">
          <Bookmark size={11} /> {post.saveCount}
        </span>
        <span className="flex items-center gap-0.5">
          <Heart size={11} /> {post.likeCount}
        </span>
      </div>
    </Link>
  );
}

function CollectionCard({ c }: { c: HomeCollection }) {
  // 대표 사진 없으면 큰 빈 박스 대신 리스트 아이콘 + 대표 맛집 이름의 텍스트 카드
  if (!c.coverUrl) {
    return (
      <Link
        href={`/collections/${c.id}`}
        className="flex h-[214px] w-[220px] shrink-0 flex-col rounded-2xl border border-stone-200 bg-stone-50 p-3.5"
      >
        <div className="flex items-center gap-1.5 text-forest">
          <ListChecks size={18} />
          <span className="text-[12px] font-bold">{c.itemCount}곳</span>
        </div>
        <div className="mt-2 line-clamp-2 text-sm font-bold text-ink">{c.title}</div>
        <div className="mt-0.5 truncate text-[12px] text-stone-400">
          {c.authorNickname} · Lv.{c.authorLevel}
        </div>
        {c.previewNames.length > 0 && (
          <div className="mt-1.5 line-clamp-2 text-[12px] text-ink-muted">
            {c.previewNames.join(" · ")}
          </div>
        )}
      </Link>
    );
  }
  return (
    <Link href={`/collections/${c.id}`} className="flex h-[214px] w-[220px] shrink-0 flex-col rounded-2xl border border-stone-200 bg-white p-2">
      <div className="relative h-[124px] overflow-hidden rounded-xl bg-stone-100">
        {c.coverUrl ? (
          <CardImage src={c.coverUrl} alt={c.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-stone-300">
            <ListChecks size={30} />
          </div>
        )}
        <span className="absolute right-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-bold text-white">
          {c.itemCount}곳
        </span>
      </div>
      <div className="mt-2 line-clamp-2 min-h-[36px] text-sm font-bold leading-tight text-ink">{c.title}</div>
      <div className="truncate text-[12px] text-stone-400">
        {c.authorNickname} · Lv.{c.authorLevel}
      </div>
      {c.previewNames.length > 0 && (
        <div className="mt-0.5 truncate text-[11px] text-stone-400">{c.previewNames.join(" · ")}</div>
      )}
    </Link>
  );
}

function RankRow({ u }: { u: UserRankRow }) {
  return (
    <li className="flex items-center gap-3 bg-white px-3.5 py-3">
      <span className={`badge-rank ${u.rank === 1 ? "bg-forest text-white" : "bg-stone-100 text-stone-500"}`}>
        {u.rank}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold text-ink">{u.nickname}</div>
        <div className="text-[11px] tabular-nums text-stone-400">{u.xp.toLocaleString()} XP</div>
      </div>
      <span className="badge-lv">Lv.{u.level}</span>
    </li>
  );
}
