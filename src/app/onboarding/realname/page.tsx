import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import RealNameForm from "@/components/RealNameForm";

export const dynamic = "force-dynamic";

export default async function RealNameOnboardingPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { legalName: true, nicknameConfirmedAt: true },
  });
  if (!user) redirect("/login");
  if (!user.nicknameConfirmedAt) redirect("/onboarding/nickname");
  if (user.legalName) redirect("/");

  return (
    <main className="px-5 py-10">
      <h1 className="text-2xl font-extrabold">실명 입력</h1>
      <p className="mt-2 text-sm leading-relaxed text-neutral-500">
        본인 확인을 위해 실명을 입력해주세요. 실명은 <b className="text-ink">비공개</b>로 안전하게 보관되고, 화면에는
        닉네임만 표시돼요.
      </p>
      <RealNameForm />
    </main>
  );
}
