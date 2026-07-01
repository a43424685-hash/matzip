import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

export default async function SuspendedPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { suspendedAt: true, suspendedReason: true },
  });
  // 정지가 아니면 홈으로
  if (!user?.suspendedAt) redirect("/");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-coral/10 text-coral">
        <ShieldAlert size={30} />
      </div>
      <h1 className="mt-5 text-xl font-black text-ink">이용이 제한된 계정이에요</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">
        운영정책에 따라 계정 이용이 제한되었어요.
      </p>
      {user.suspendedReason && (
        <div className="mt-4 w-full max-w-sm rounded-2xl bg-stone-50 p-4 text-left text-[13px] text-ink">
          <div className="mb-1 text-[12px] font-bold text-stone-400">사유</div>
          {user.suspendedReason}
        </div>
      )}
      <p className="mt-4 text-[12px] text-stone-400">
        문의가 있으면 고객센터(설정 &gt; 고객센터)로 연락 주세요.
      </p>
      <div className="mt-6">
        <LogoutButton />
      </div>
    </main>
  );
}
