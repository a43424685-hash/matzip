import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import ProfileSetupForm from "@/components/ProfileSetupForm";

export const dynamic = "force-dynamic";

// 가입 온보딩 — 닉네임 + 실명을 한 화면에서 한 번에.
export default async function OnboardingPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { nickname: true, nicknameConfirmedAt: true, legalName: true },
  });
  if (!user) redirect("/login");
  // 이미 둘 다 끝난 사용자는 앱으로
  if (user.nicknameConfirmedAt && user.legalName) redirect("/");

  // 소셜 로그인 기본 닉네임(예: 구글-xxxx)은 규칙에 안 맞으니 비워서 직접 입력하게.
  const nickDefault = user.nicknameConfirmedAt ? user.nickname : "";

  return (
    <main className="px-5 py-10">
      <h1 className="text-2xl font-extrabold text-ink">시작하기 전에</h1>
      <p className="mt-2 text-sm text-ink-muted">닉네임과 실명만 정하면 바로 시작해요.</p>
      <ProfileSetupForm nickname={nickDefault} />
    </main>
  );
}
