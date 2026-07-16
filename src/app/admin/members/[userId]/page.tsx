import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldCheck, MapPin, Star, ShoppingBag } from "lucide-react";
import { getMemberDetail } from "@/server/admin/MemberService";
import { listAuditForTarget } from "@/server/admin/AuditService";
import AdminMemberActions from "@/components/admin/AdminMemberActions";
import { setPurchaseBlockedAction } from "@/app/actions/admin-member";
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
function ymdhm(d: Date | string | null) {
  if (!d) return "기록 없음";
  const x = new Date(d);
  return `${ymd(x)} ${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`;
}
const PROVIDER_LABEL: Record<string, string> = { kakao: "카카오", apple: "애플", email: "이메일", credentials: "이메일" };
const ACTION_LABEL: Record<string, string> = {
  suspend: "계정 정지",
  unsuspend: "정지 해제",
  memo: "메모",
  view_account: "계좌 열람",
};

export default async function AdminMemberDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  async function unblockPurchase(formData: FormData) {
    "use server";
    await setPurchaseBlockedAction(undefined, formData);
  }
  const { userId } = await params;
  const data = await getMemberDetail(userId);
  if (!data) notFound();
  const { user: u, earnings, recentPosts, verifiedCount, reportsAgainst, purchases, soldMaps } = data;
  const audits = await listAuditForTarget("user", userId);

  const hasAccount = !!u.bankName && !!u.accountNumber && !!u.accountHolder;
  const providers =
    u.authAccounts.length > 0
      ? [...new Set(u.authAccounts.map((a) => PROVIDER_LABEL[a.provider] ?? a.provider))].join(", ")
      : "이메일";

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
            {u.suspendedAt && <span className="rounded bg-coral/10 px-1.5 py-0.5 text-[11px] font-bold text-coral-dark">정지됨</span>}
            {u.deactivatedAt && <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[11px] text-stone-400">휴면</span>}
          </div>
          <div className="text-[13px] text-stone-400">Lv.{u.totalLevel} · XP {won(u.totalXp)} · 가입 {ymd(u.createdAt)}</div>
        </div>
      </div>

      {/* 개인정보 (마스킹) */}
      <Section title="개인정보 (본인확인·정산용)">
        <Field label="이메일" value={maskEmail(u.email)} />
        <Field label="가입 경로" value={providers} />
        <Field label="최근 접속" value={ymdhm(u.lastLoginAt)} />
        <Field label="실명" value={u.legalName ? maskName(u.legalName) : "미등록"} />
        <Field
          label="정산 계좌"
          value={hasAccount ? `${u.bankName} · ${maskAccountNumber(decryptField(u.accountNumber))}` : "미등록"}
        />
        <Field label="예금주" value={u.accountHolder ? maskName(u.accountHolder) : "-"} />
        <p className="col-span-2 mt-1 text-[11px] text-stone-400 sm:col-span-4">
          ※ 개인정보는 일부만 표시돼요. 실제 이체가 필요한 계좌 원문은 정산 화면에서 확인하세요.
        </p>
      </Section>

      {/* 활동 지표 */}
      <Section title="활동">
        <Stat label="작성 글" value={`${u._count.posts}`} />
        <Stat label="위치인증 맛집" value={`${verifiedCount}`} />
        <Stat label="팔로워" value={`${u._count.followers}`} />
        <Stat label="팔로잉" value={`${u._count.following}`} />
      </Section>

      {/* 거래·정산 */}
      <Section title="거래 · 정산">
        <Stat label="지도 구매" value={`${u._count.mapPurchases}건`} />
        <Stat label="총 판매" value={`${earnings.salesCount}건`} />
        <Stat label="총 판매액" value={`${won(earnings.totalGrossWon)}원`} />
        <Stat label="정산액(셀러 몫)" value={`${won(earnings.totalNetWon)}원`} />
        <Stat label="출금 신청" value={`${u._count.withdrawals}건`} />
        <Stat label="내 지도" value={`${u._count.collections}개`} />
      </Section>

      {/* 신뢰·안전 */}
      <Section title="신뢰 · 안전">
        <Stat label="이 회원 차단 수" value={`${u._count.blockedBy}`} warn={u._count.blockedBy > 0} />
        <Stat label="신고 당한 수" value={`${reportsAgainst}`} warn={reportsAgainst > 0} />
        <Stat label="접수한 신고" value={`${u._count.reports}`} />
        <Stat label="누적 환불" value={`${u.refundCount}회`} warn={u.refundCount > 0} />
        <Stat label="구매 제한" value={u.purchaseBlocked ? "차단됨" : "정상"} warn={u.purchaseBlocked} />
      </Section>

      {/* 상습환불 구매 제한 관리 — 오탐(웹훅 중복 등) 복구용 */}
      {u.purchaseBlocked && (
        <form action={unblockPurchase} className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-[13px] font-bold text-ink">이 회원은 반복 환불로 유료지도 구매가 차단된 상태예요.</p>
          <input type="hidden" name="userId" value={u.id} />
          <input type="hidden" name="blocked" value="0" />
          <input
            name="reason"
            required
            placeholder="해제 사유 (감사로그에 기록)"
            className="input mt-2 !h-10 !text-[13px]"
          />
          <button type="submit" className="btn-outline mt-2 h-10 w-full !text-[13px]">
            구매 제한 해제 (환불 카운트 리셋)
          </button>
        </form>
      )}

      {/* 운영자 조치 */}
      <AdminMemberActions userId={u.id} suspended={!!u.suspendedAt} isTargetAdmin={u.isAdmin} />

      {/* 감사 로그 */}
      <div className="mt-6">
        <h2 className="mb-2 text-sm font-extrabold text-ink">조치 이력 (감사로그)</h2>
        {audits.length === 0 ? (
          <p className="rounded-2xl bg-white p-4 text-center text-[13px] text-stone-400">기록이 없어요.</p>
        ) : (
          <div className="space-y-2">
            {audits.map((a) => (
              <div key={a.id} className="rounded-xl border border-stone-200 bg-white p-3 text-[13px]">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-ink">{ACTION_LABEL[a.action] ?? a.action}</span>
                  <span className="text-[11px] text-stone-400">{ymdhm(a.createdAt)} · {a.adminNickname}</span>
                </div>
                {a.reason && <p className="mt-1 text-stone-500">{a.reason}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 구매/판매 지도 */}
      {(purchases.length > 0 || soldMaps.length > 0) && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {purchases.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-extrabold text-ink">구매한 지도</h2>
              <div className="space-y-1.5">
                {purchases.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-xl border border-stone-200 bg-white p-2.5 text-[13px]">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <ShoppingBag size={13} className="shrink-0 text-stone-400" />
                      <span className="truncate text-ink">{p.collection.title}</span>
                    </span>
                    <span className={`shrink-0 ${p.status === "refunded" ? "text-stone-400 line-through" : "text-stone-500"}`}>
                      {won(p.amountWon)}원
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {soldMaps.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-extrabold text-ink">판매 지도(내 지도)</h2>
              <div className="space-y-1.5">
                {soldMaps.map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded-xl border border-stone-200 bg-white p-2.5 text-[13px]">
                    <span className="truncate text-ink">{m.title}</span>
                    <span className="shrink-0 text-stone-500">{m._count.purchases}건 판매</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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
    <div className="min-w-0 rounded-xl border border-stone-200 bg-white p-3">
      <div className="text-[11px] text-stone-400">{label}</div>
      <div className="mt-0.5 break-all text-[13px] font-semibold text-ink">{value}</div>
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
