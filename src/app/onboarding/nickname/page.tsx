import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import NicknameForm from "@/components/NicknameForm";

export const dynamic = "force-dynamic";

export default async function NicknameOnboardingPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { nickname: true, nicknameConfirmedAt: true },
  });
  if (!user) redirect("/login");
  if (user.nicknameConfirmedAt) redirect("/");

  return (
    <main className="px-5 py-10">
      <h1 className="text-2xl font-extrabold">닉네임 정하기</h1>
      <p className="mt-2 text-sm text-neutral-500">
        랭킹과 맛집 카드에 보일 이름이에요.
      </p>
      <NicknameForm nickname={user.nickname} />
    </main>
  );
}
