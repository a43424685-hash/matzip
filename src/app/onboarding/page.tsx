import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";
import ProfileSetupForm from "@/components/ProfileSetupForm";

export const dynamic = "force-dynamic";

// 가입 온보딩 — 닉네임 하나만 정하면 끝.
// 실명·이메일은 여기서 묻지 않는다(Apple 가이드라인 4: 소셜 로그인 후 이름·이메일 재요구 금지).
export default async function OnboardingPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { nickname: true, nicknameConfirmedAt: true },
  });
  if (!user) redirect("/login");
  // 이미 끝난 사용자는 앱으로
  if (user.nicknameConfirmedAt) redirect("/");

  // 소셜 로그인 기본 닉네임(예: 구글-xxxx)은 규칙에 안 맞으니 비워서 직접 입력하게.
  const nickDefault = user.nicknameConfirmedAt ? user.nickname : "";

  return (
    <main className="px-5 py-10">
      <h1 className="text-2xl font-extrabold text-ink">시작하기 전에</h1>
      <p className="mt-2 text-sm text-ink-muted">앱에서 쓸 닉네임만 정하면 바로 시작해요.</p>
      <ProfileSetupForm nickname={nickDefault} />
      {/* 막다른 길 방지 — 진행을 원치 않으면 나갈 수 있게 */}
      <form action={logoutAction} className="mt-6 text-center">
        <button type="submit" className="text-[13px] text-stone-400 underline">
          나중에 할게요 (로그아웃)
        </button>
      </form>
    </main>
  );
}
