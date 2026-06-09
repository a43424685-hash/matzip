import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, UserCog, Link2, Bell, MapPin, LogOut, UserX } from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";
import MeSubPageHeader from "@/components/MeSubPageHeader";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const kakao = await prisma.authAccount.findFirst({
    where: { userId: user.id, provider: "kakao" },
    select: { id: true },
  });

  return (
    <main className="px-5 pb-24 pt-5">
      <MeSubPageHeader title="설정" />

      <div className="divide-y divide-stone-100">
        <Link href="/me/soon?t=닉네임 변경" className="flex items-center gap-3 px-1 py-3.5 active:bg-stone-50">
          <UserCog size={18} className="text-stone-400" />
          <span className="flex-1 text-[15px] text-ink">닉네임 변경</span>
          <span className="text-[13px] text-stone-400">{user.nickname}</span>
          <ChevronRight size={18} className="text-stone-300" />
        </Link>

        <div className="flex items-center gap-3 px-1 py-3.5">
          <Link2 size={18} className="text-stone-400" />
          <span className="flex-1 text-[15px] text-ink">카카오 계정 연결</span>
          <span className={`text-[13px] font-semibold ${kakao ? "text-forest" : "text-stone-400"}`}>
            {kakao ? "연결됨" : "연결 안 됨"}
          </span>
        </div>

        <Link href="/me/soon?t=알림 설정" className="flex items-center gap-3 px-1 py-3.5 active:bg-stone-50">
          <Bell size={18} className="text-stone-400" />
          <span className="flex-1 text-[15px] text-ink">알림 설정</span>
          <ChevronRight size={18} className="text-stone-300" />
        </Link>

        <Link href="/me/soon?t=위치 권한 안내" className="flex items-center gap-3 px-1 py-3.5 active:bg-stone-50">
          <MapPin size={18} className="text-stone-400" />
          <span className="flex-1 text-[15px] text-ink">위치 권한 안내</span>
          <ChevronRight size={18} className="text-stone-300" />
        </Link>

        <form action={logoutAction}>
          <button type="submit" className="flex w-full items-center gap-3 px-1 py-3.5 text-left text-[15px] text-ink-muted">
            <LogOut size={18} className="text-stone-400" /> 로그아웃
          </button>
        </form>

        <Link href="/me/soon?t=회원 탈퇴" className="flex items-center gap-3 px-1 py-3.5 active:bg-stone-50">
          <UserX size={18} className="text-stone-400" />
          <span className="flex-1 text-[15px] text-stone-400">회원 탈퇴</span>
          <ChevronRight size={18} className="text-stone-300" />
        </Link>
      </div>
    </main>
  );
}
