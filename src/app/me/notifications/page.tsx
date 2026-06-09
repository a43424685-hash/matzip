import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listNotifications, markAllRead } from "@/server/notification/NotificationService";
import MeSubPageHeader from "@/components/MeSubPageHeader";
import NotificationListView from "@/components/NotificationListView";

export const dynamic = "force-dynamic";

export default async function MeNotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const rows = await listNotifications(user.id);
  await markAllRead(user.id);

  return (
    <main className="px-5 pb-24 pt-5">
      <MeSubPageHeader title="알림함" />
      <NotificationListView rows={rows} />
    </main>
  );
}
