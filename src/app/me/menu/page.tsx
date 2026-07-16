import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ChevronRight,
  Pencil,
  Settings,
  BellRing,
  ShieldAlert,
  Info,
  Headphones,
  FileText,
  Upload,
  LayoutDashboard,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import MeSubPageHeader from "@/components/MeSubPageHeader";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

/** 설정 및 활동 허브 — 프로필의 삼선(≡)에서 진입. 설정성 항목을 그룹으로 모음. */
export default async function MeMenuPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <main className="px-5 pb-16 pt-5">
      <MeSubPageHeader title="설정 및 활동" />

      <Group title="내 활동">
        <Row href="/me/profile" icon={<Pencil size={18} />} label="프로필 편집" />
        {/* 혜택 모음·정직 리뷰 캠페인은 사장님 기능 오픈 전까지 숨김 (앱 심사 4.2: 준비중 화면 노출 방지)
            복원: 아래 두 줄 주석 해제
        <Row href="/me/benefits" icon={<Gift size={18} />} label="혜택 모음" />
        <Row href="/me/review-campaigns" icon={<Megaphone size={18} />} label="정직 리뷰 캠페인" /> */}
      </Group>

      <Group title="계정 · 개인정보">
        <Row href="/me/settings" icon={<Settings size={18} />} label="설정" />
        <Row href="/me/notification-settings" icon={<BellRing size={18} />} label="알림 설정" />
        <Row href="/me/blocked-users" icon={<ShieldAlert size={18} />} label="차단한 사용자" />
        <Row href="/me/reports" icon={<ShieldAlert size={18} />} label="신고 / 제재 내역" />
      </Group>

      <Group title="정보 · 지원">
        <Row href="/me/notices" icon={<Info size={18} />} label="공지사항" />
        <Row href="/me/support" icon={<Headphones size={18} />} label="고객센터" />
        <Row href="/terms" icon={<FileText size={18} />} label="약관 및 정책" sub="이용약관·개인정보·환불정책" />
      </Group>

      {user.isAdmin && (
        <Group title="운영자">
          <Row href="/admin" icon={<LayoutDashboard size={18} />} label="관리자 대시보드" sub="회원·정산·환불·신고 (PC 권장)" />
          <Row href="/me/admin/import" icon={<Upload size={18} />} label="맛집 일괄등록" sub="네이버 즐겨찾기로 운영자 PICK" />
        </Group>
      )}

      <div className="mt-8 border-t border-stone-100 pt-2">
        <LogoutButton />
      </div>
    </main>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="mb-1 px-1 text-[13px] font-bold text-stone-400">{title}</h2>
      <div className="divide-y divide-stone-100">{children}</div>
    </section>
  );
}

function Row({ href, icon, label, sub }: { href: string; icon: React.ReactNode; label: string; sub?: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 px-1 py-3.5 active:bg-stone-50">
      <span className="text-stone-400">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] text-ink">{label}</span>
        {sub && <span className="block text-[12px] text-stone-400">{sub}</span>}
      </span>
      <ChevronRight size={18} className="shrink-0 text-stone-300" />
    </Link>
  );
}
