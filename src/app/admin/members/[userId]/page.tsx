import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldCheck, MapPin, Star } from "lucide-react";
import { getMemberDetail } from "@/server/admin/MemberService";
import {
  decryptField,
  maskAccountNumber,
  maskName,
  maskEmail,
} from "@/lib/fieldCrypto";

export const dynamic = "force-dynamic";

const won = (n: number) => n.toLocaleString();
function ymd(d: Date | string) {
  const x = new Date(d);
  return `${x.getFullYear()}.${String(x.getMonth() + 1).padStart(2, "0")}.${String(x.getDate()).padStart(2, "0")}`;
}

export default async function AdminMemberDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const data = await getMemberDetail(userId);
  if (!data) notFound();
  const { user: u, earnings, recentPosts } = data;

  const hasAccount = !!u.bankName && !!u.accountNumber && !!u.accountHolder;

  return (
    <div>
      <Link href="/admin/members" className="mb-3 inline-flex items-center gap-1 text-[13px] font-semibold text-stone-400">
        <ArrowLeft size={15} /> 회원 목록
      </Link>

      {/* 프로필 헤더 */}
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-stone-100 text-lg font-black text-stone-400">
          {u.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={u.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            u.nickname.slice(0, 1)
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-lg font-black text-ink">
            {u.nickname}
            {u.isAdmin && <ShieldCheck size={16} className="text-forest" />}
            {u.deactivatedAt && <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[11px] text-stone-400">휴면</span>}
          </div>
          <div className="text-[13px] text-stone-400">Lv.{u.totalLevel} · XP {won(u.totalXp)} · 가입 {ymd(u.createdAt)}</div>
        </div>
      </div>

      {/* 개인정보 (마스킹) */}
      <Section title="개인정보 (본인확인·정산용)">
        <Field label="이메일" value={maskEmail(u.email)} />
        <Field label="실명" value={u.legalName ? maskName(u.legalName) : "미등록"} />
        <Field
          label="정산 계좌"
          value={hasAccount ? `${u.bankName} · ${maskAccountNumber(decryptField(u.accountNumber))}` : "미등록"}
        />
        <Field label="예금주" value={u.accountHolder ? maskName(u.accountHolder) : "-"} />
        <p className="col-span-2 mt-1 text-[11px] text-stone-400">
          ※ 개인정보는 일부만 표시돼요. 실제 이체가 필요한 계좌 원문은 정산 화면에서 확인하세요.
        </p>
      </Section>

      {/* 활동 지표 */}
      <Section title="활동">
        <Stat label="작성 글" value={`${u._count.posts}`} />
        <Stat label="팔로워" value={`${u._count.followers}`} />
        <Stat label="팔로잉" value={`${u._count.following}`} />
        <Stat label="내 지도(컬렉션)" value={`${u._count.collections}`} />
      </Section>

      {/* 거래·정산 */}
      <Section title="거래 · 정산">
        <Stat label="지도 구매" value={`${u._count.mapPurchases}건`} />
        <Stat label="총 판매" value={`${earnings.salesCount}건`} />
        <Stat label="총 판매액" value={`${won(earnings.totalGrossWon)}원`} />
        <Stat label="정산액(70%)" value={`${won(earnings.totalNetWon)}원`} />
        <Stat label="출금 신청" value={`${u._count.withdrawals}건`} />
      </Section>

      {/* 신뢰·안전 */}
      <Section title="신뢰 · 안전">
        <Stat label="이 회원 차단 수" value={`${u._count.blockedBy}`} warn={u._count.blockedBy > 0} />
        <Stat label="접수한 신고" value={`${u._count.reports}`} />
      </Section>

      {/* 최근 글 */}
      <div className="mt-6">
        <h2 className="mb-2 text-sm font-extrabold text-ink">최근 작성 글</h2>
        {recentPosts.length === 0 ? (
          <p className="rounded-2xl bg-white p-4 text-center text-[13px] text-stone-400">작성한 글이 없어요.</p>
        ) : (
          <div className="space-y-2">
            {recentPosts.map((p) => (
              <Link
                key={p.id}
                href={`/restaurants/${p.id}`}
                className="flex items-center gap-2 rounded-2xl border border-stone-200 bg-white p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-bold text-ink">{p.restaurant.name}</div>
                  {p.shortReview && <div className="truncate text-[12px] text-stone-400">{p.shortReview}</div>}
                </div>
                {p.locationVerified && <MapPin size={13} className="shrink-0 text-forest" />}
                {p.isOperatorPick && <Star size={13} className="shrink-0 text-amber-500" />}
                <span className="shrink-0 text-[11px] text-stone-400">{ymd(p.createdAt)}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-sm font-extrabold text-ink">{title}</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3">
      <div className="text-[11px] text-stone-400">{label}</div>
      <div className="mt-0.5 text-[13px] font-semibold text-ink">{value}</div>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${warn ? "border-coral/40 bg-coral/5" : "border-stone-200 bg-white"}`}>
      <div className={`text-base font-extrabold tabular-nums ${warn ? "text-coral-dark" : "text-ink"}`}>{value}</div>
      <div className="mt-0.5 text-[11px] text-stone-400">{label}</div>
    </div>
  );
}
