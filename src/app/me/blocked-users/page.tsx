import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listBlocked } from "@/server/block/BlockService";
import MeSubPageHeader from "@/components/MeSubPageHeader";
import BlockedList from "@/components/BlockedList";

export const dynamic = "force-dynamic";

export default async function BlockedUsersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const rows = await listBlocked(user.id);

  return (
    <main className="px-5 pb-24 pt-5">
      <MeSubPageHeader backHref="/me/menu" title="차단한 사용자" />
      <p className="text-[13px] text-ink-muted">
        차단한 사용자의 글과 댓글은 보이지 않아요. 언제든 해제할 수 있어요.
      </p>
      <BlockedList rows={rows} />
    </main>
  );
}
