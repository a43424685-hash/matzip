import Link from "next/link";
import { BadgePercent, CalendarDays, Megaphone, TicketPercent } from "lucide-react";
import BackHomeHeader from "@/components/BackHomeHeader";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const benefitSections = [
  {
    title: "오늘의 방문 혜택",
    body: "위치 인증 가능한 맛집을 먼저 보여주고, 추후 쿠폰과 사장님 이벤트를 연결합니다.",
    Icon: TicketPercent,
    href: "/search?sort=weekly",
  },
  {
    title: "사장님 소식",
    body: "광고처럼 꾸민 글이 아니라, 가게가 직접 올린 메뉴·야장·시즌 소식을 모읍니다.",
    Icon: Megaphone,
    href: "/benefits",
  },
  {
    title: "이번 주 이벤트",
    body: "인증 리뷰, 지역 랭킹, 시즌 카테고리를 묶어 앱 안에서 계속 돌 수 있게 만듭니다.",
    Icon: CalendarDays,
    href: "/rankings",
  },
];

export default async function BenefitsPage() {
  const promotions = await prisma.ownerPromotion.findMany({
    where: {
      OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }],
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      title: true,
      content: true,
      promotionType: true,
      restaurant: { select: { name: true, posts: { select: { id: true }, take: 1, orderBy: { createdAt: "desc" } } } },
    },
  });

  return (
    <main className="px-5 py-6">
      <BackHomeHeader title="혜택 모음" />

      <section className="rounded-3xl bg-forest px-5 py-6 text-white">
        <BadgePercent size={26} />
        <h2 className="mt-3 text-2xl font-extrabold">먹고핀 혜택 모음</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/80">
          쿠폰, 사장님 홍보, 시즌 이벤트를 홈과 분리해서 모아두는 공간입니다.
        </p>
      </section>

      <div className="mt-5 space-y-3">
        {benefitSections.map(({ title, body, Icon, href }) => (
          <Link key={title} href={href} className="card flex items-center gap-3 p-4 active:scale-[0.99]">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-forest-soft text-forest">
              <Icon size={22} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-extrabold text-ink">{title}</span>
              <span className="mt-0.5 line-clamp-2 block text-[12px] leading-relaxed text-ink-muted">{body}</span>
            </span>
          </Link>
        ))}
      </div>

      <section className="mt-8">
        <h2 className="section-title">진행 중인 가게 소식</h2>
        <p className="mt-1 text-[13px] text-ink-muted">사장님 홍보와 이벤트가 여기에 쌓입니다.</p>

        {promotions.length === 0 ? (
          <div className="mt-3 rounded-2xl bg-stone-50 px-4 py-8 text-center">
            <p className="text-sm font-semibold text-ink">아직 등록된 혜택이 없어요.</p>
            <p className="mt-1 text-[13px] text-ink-muted">수익화 단계에서 쿠폰과 홍보 등록을 붙이면 바로 채워집니다.</p>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {promotions.map((p) => {
              const postId = p.restaurant.posts[0]?.id;
              return (
                <Link
                  key={p.id}
                  href={postId ? `/restaurants/${postId}` : "/benefits"}
                  className="card block p-4 active:scale-[0.99]"
                >
                  <div className="text-[12px] font-bold text-forest">{p.restaurant.name}</div>
                  <div className="mt-1 text-sm font-extrabold text-ink">{p.title}</div>
                  {p.content && <p className="mt-1 line-clamp-2 text-[13px] text-ink-muted">{p.content}</p>}
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
