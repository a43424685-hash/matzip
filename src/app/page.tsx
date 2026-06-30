import Link from "next/link";
import {
  Bell,
  ChevronRight,
  Bookmark,
  Heart,
  ShieldCheck,
  Trophy,
  Play,
  Coins,
  Plus,
  Check,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getHomeData, type PaidMapCard } from "@/server/home";
import { unreadCount } from "@/server/notification/NotificationService";
import type { PostCard } from "@/server/restaurant/RestaurantService";
import type { UserRankRow } from "@/server/ranking/RankingService";
import CardImage from "@/components/CardImage";
import CategoryIconGrid from "@/components/CategoryIconGrid";
import SiteFooter from "@/components/SiteFooter";
import NearbyHomeSection from "@/components/NearbyHomeSection";
import Coachmark from "@/components/Coachmark";
import WelcomeOnboarding from "@/components/WelcomeOnboarding";

export const dynamic = "force-dynamic";

// sticky 카테고리 메뉴 (이름으로 조회 → /search 링크)
const NAV_CATS = ["노포", "야장", "가성비", "데이트", "혼밥", "카페", "술집", "회식", "비 오는 날", "부모님 모시기 좋음"];
// 표시용 짧은 라벨
const SHORT: Record<string, string> = { "부모님 모시기 좋음": "부모님", "겨울 국물": "국물" };

function formatPostDate(value: Date | string) {
  const date = new Date(value);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

export default async function HomePage() {
  const user = await getCurrentUser();
  const { weekly, recent, saved, topUsers, categories, myPostCount, paidMaps } = await getHomeData(user?.id);
  const unread = user ? await unreadCount(user.id) : 0;

  const idByName = new Map(categories.map((c) => [c.name, c.id]));
  const navCats = NAV_CATS.map((n) => ({ name: SHORT[n] ?? n, id: idByName.get(n) })).filter(
    (c): c is { name: string; id: string } => !!c.id
  );

  return (
    <main className="bg-white pb-8">
      <WelcomeOnboarding />
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
              <Link href="/login" className="text-stone-500" aria-label="알림 — 로그인이 필요해요">
                <Bell size={22} strokeWidth={1.9} />
              </Link>
            )}
          </div>
        </div>

        <p className="mt-4 text-[15px] font-extrabold leading-snug text-ink">
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
      <SectionHead title="이번 주 인기 맛집" sub="사람들이 많이 저장한 곳" href="/feed?sort=weekly" />
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

      {/* 섹션 2. 내 주변 인증 맛집 (GPS 기반) */}
      <NearbyHomeSection />

      {/* 섹션 3. 갓 올라온 맛집 (미인증 포함, 최신순) */}
      <SectionHead title="갓 올라온 맛집" sub="방금 등록된 따끈한 맛집" href="/feed?sort=latest" />
      {recent.length === 0 ? (
        <Empty>아직 등록된 맛집이 없어요. 첫 맛집을 올려보세요!</Empty>
      ) : (
        <div className="no-scrollbar flex items-start gap-3 overflow-x-auto px-5 pb-1">
          {photoFirst(recent).map((p) =>
            p.media ? <PhotoCard key={p.id} post={p} /> : <TextPostCard key={p.id} post={p} />
          )}
        </div>
      )}

      {/* 섹션 4-2. 유료 맛집 지도 — 둘러보고 구매 (누구나 Lv.1부터 구매 가능) */}
      <div className="flex items-end justify-between px-5 pb-3 pt-9">
        <div>
          <h2 className="section-title flex items-center gap-1.5">
            <Coins size={17} className="text-forest" /> 유료 맛집 지도
          </h2>
          <p className="mt-1 text-[13px] text-ink-muted">검증된 로컬이 직접 만든 진짜 맛집 지도</p>
        </div>
        <Link href="/store" className="flex items-center text-[13px] font-semibold text-forest">
          전체 <ChevronRight size={15} />
        </Link>
      </div>
      {paidMaps.length === 0 ? (
        <Link
          href="/store"
          className="mx-5 flex items-center justify-between rounded-2xl border border-stone-200 bg-white p-4 active:scale-[0.99]"
        >
          <span className="flex items-center gap-2 text-sm font-bold text-ink">
            <Coins size={18} className="text-forest" /> 지도 둘러보고 구매하기
          </span>
          <ChevronRight size={18} className="text-stone-300" />
        </Link>
      ) : (
        <div className="no-scrollbar flex items-start gap-3 overflow-x-auto px-5 pb-1">
          {paidMaps.map((m) => (
            <PaidMapCardItem key={m.id} map={m} />
          ))}
        </div>
      )}

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

      {/* 첫 사용자 코치마크 — + 버튼 안내 */}
      <Coachmark
        storageKey="mukgopin:coach-home-fab"
        enabled={!!user && myPostCount === 0}
        text="여기 ➕ 를 눌러 첫 맛집을 등록해보세요!"
        position="fixed bottom-[150px] right-4 max-w-[230px]"
        arrow="down"
      />

      {/* 맛집 등록 FAB (홈에서만) — 비로그인은 로그인으로 */}
      <Link
        href={user ? "/register" : "/login"}
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
        전체보기 <ChevronRight size={15} />
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
        <div className="absolute left-2 top-2 flex gap-1">
          {post.isOfficial && (
            <span className="flex items-center gap-1 rounded-full bg-[#1d9bf0] px-2 py-0.5 text-[11px] font-bold text-white">
              <Check size={11} strokeWidth={3.2} /> 운영자
            </span>
          )}
          {(showVerified || post.verification.location) && (
            <span className="flex items-center gap-1 rounded-full bg-forest/90 px-2 py-0.5 text-[11px] font-bold text-white">
              <ShieldCheck size={11} /> 인증
            </span>
          )}
          {!post.isOfficial && !post.verification.location && !showVerified && (
            <span className="rounded-full bg-stone-500/80 px-2 py-0.5 text-[11px] font-bold text-white">미인증</span>
          )}
        </div>
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
        <div className="relative z-[1] flex w-fit gap-1">
          {post.isOfficial && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#1d9bf0] px-2 py-0.5 text-[11px] font-bold text-white">
              <Check size={11} strokeWidth={3.2} /> 운영자
            </span>
          )}
          {(showVerified || post.verification.location) && (
            <span className="inline-flex items-center gap-1 rounded-full bg-forest/90 px-2 py-0.5 text-[11px] font-bold text-white">
              <ShieldCheck size={11} /> 인증
            </span>
          )}
          {!post.isOfficial && !post.verification.location && !showVerified && (
            <span className="inline-flex rounded-full bg-stone-500/80 px-2 py-0.5 text-[11px] font-bold text-white">미인증</span>
          )}
        </div>
        <div className="relative z-[1] mt-auto">
          <div className="text-[11px] font-bold text-forest">사진 준비 중</div>
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

// 유료 맛집 지도 카드 (홈 가로 스크롤)
function PaidMapCardItem({ map }: { map: PaidMapCard }) {
  return (
    <Link
      href={`/collections/${map.id}`}
      className="flex h-[238px] w-[184px] shrink-0 flex-col rounded-2xl border border-stone-200 bg-white p-2"
    >
      <div className="relative h-[132px] overflow-hidden rounded-xl bg-stone-100">
        {map.coverUrl ? (
          <CardImage src={map.coverUrl} alt={map.title} label="사진 준비 중" className="h-full w-full object-cover" />
        ) : (
          <div className="thumb-empty h-full w-full" />
        )}
        <span className="absolute right-2 top-2 rounded-full bg-forest px-2 py-0.5 text-[11px] font-extrabold text-white">
          {map.priceWon.toLocaleString()}원
        </span>
      </div>
      <div className="mt-2 line-clamp-2 min-h-[40px] text-sm font-bold leading-tight text-ink">{map.title}</div>
      <div className="truncate text-[12px] text-stone-400">{map.regionName} · 맛집 {map.itemCount}곳</div>
      <div className="mt-auto truncate text-[11px] font-semibold text-forest">{map.authorNickname}</div>
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
        <div className="text-[11px] tabular-nums text-stone-400">
          {u.xp.toLocaleString()} XP{u.verifiedCount > 0 && ` · 인증 ${u.verifiedCount}곳`}
        </div>
      </div>
      <span className="badge-lv">Lv.{u.level}</span>
    </li>
  );
}
