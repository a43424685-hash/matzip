import Link from "next/link";
import { Search, ChevronRight, ShieldCheck } from "lucide-react";
import { searchMembers, countMembers } from "@/server/admin/MemberService";
import { maskEmail } from "@/lib/fieldCrypto";

export const dynamic = "force-dynamic";

const PAGE = 30;

function ymd(d: Date) {
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() || "";
  const skip = Math.max(0, parseInt(sp.skip ?? "0", 10) || 0);

  const [rows, total] = await Promise.all([searchMembers(q, skip, PAGE), countMembers()]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-ink">회원 관리</h1>
        <span className="text-[13px] text-stone-400">전체 {total.toLocaleString()}명</span>
      </div>

      <form action="/admin/members" method="get" className="mt-4 flex h-11 items-center gap-2 rounded-full bg-white px-4 ring-1 ring-stone-200">
        <Search size={17} className="shrink-0 text-stone-400" />
        <input
          name="q"
          defaultValue={q}
          placeholder="닉네임 · 이메일 검색"
          className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-stone-400"
        />
        <button type="submit" className="shrink-0 rounded-full bg-ink px-3 py-1 text-[13px] font-bold text-white">검색</button>
      </form>

      <div className="mt-4 overflow-hidden rounded-2xl border border-stone-200 bg-white">
        <table className="w-full min-w-[720px] text-[13px]">
          <thead className="bg-stone-50 text-stone-400">
            <tr className="text-left">
              <th className="px-4 py-2.5 font-semibold">회원</th>
              <th className="px-3 py-2.5 font-semibold">이메일</th>
              <th className="px-3 py-2.5 text-center font-semibold">Lv</th>
              <th className="px-3 py-2.5 text-right font-semibold">글</th>
              <th className="px-3 py-2.5 text-right font-semibold">팔로워</th>
              <th className="px-3 py-2.5 text-right font-semibold">구매</th>
              <th className="px-3 py-2.5 font-semibold">가입일</th>
              <th className="px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-stone-400">검색 결과가 없어요.</td>
              </tr>
            ) : (
              rows.map((m) => (
                <tr key={m.id} className="border-t border-stone-100 hover:bg-stone-50/60">
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/members/${m.id}`} className="flex items-center gap-1.5 font-bold text-ink">
                      {m.nickname}
                      {m.isAdmin && <ShieldCheck size={13} className="text-forest" />}
                      {m.deactivated && <span className="rounded bg-stone-100 px-1 text-[10px] text-stone-400">휴면</span>}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-stone-500">{maskEmail(m.email)}</td>
                  <td className="px-3 py-2.5 text-center tabular-nums text-stone-600">{m.totalLevel}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-stone-600">{m.postCount}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-stone-600">{m.followerCount}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-stone-600">{m.purchaseCount}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-stone-400">{ymd(m.createdAt)}</td>
                  <td className="px-2 py-2.5 text-right">
                    <Link href={`/admin/members/${m.id}`} className="text-forest"><ChevronRight size={16} /></Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      <div className="mt-4 flex items-center justify-between">
        {skip > 0 ? (
          <PageLink q={q} skip={Math.max(0, skip - PAGE)} label="← 이전" />
        ) : <span />}
        {rows.length === PAGE ? (
          <PageLink q={q} skip={skip + PAGE} label="다음 →" />
        ) : <span />}
      </div>
    </div>
  );
}

function PageLink({ q, skip, label }: { q: string; skip: number; label: string }) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (skip) params.set("skip", String(skip));
  return (
    <Link href={`/admin/members?${params.toString()}`} className="rounded-full bg-white px-4 py-2 text-[13px] font-bold text-ink ring-1 ring-stone-200">
      {label}
    </Link>
  );
}
