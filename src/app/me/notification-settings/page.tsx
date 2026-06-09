import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import MeSubPageHeader from "@/components/MeSubPageHeader";
import NotificationSettings from "@/components/NotificationSettings";

export const dynamic = "force-dynamic";

export default async function NotificationSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const prefs = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { notifyLike: true, notifyComment: true },
  });
  return (
    <main className="px-5 pb-24 pt-5">
      <MeSubPageHeader title="알림 설정" />
      <NotificationSettings initial={prefs} />
    </main>
  );
}
