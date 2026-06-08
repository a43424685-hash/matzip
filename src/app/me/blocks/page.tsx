import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, Ban } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { listBlocked } from "@/server/block/BlockService";
import BlockedList from "@/components/BlockedList";

export const dynamic = "force-dynamic";

export default async function BlocksPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const rows = await listBlocked(user.id);

  return (
    <main className="px-5 py-6">
      <Link href="/me" className="mb-2 flex items-center gap-1 text-sm text-stone-400">
        <ChevronLeft size={16} /> 마이페이지
      </Link>
      <h1 className="flex items-center gap-2 text-xl font-extrabold text-ink">
        <Ban size={20} className="text-stone-500" /> 차단한 사용자
      </h1>
      <p className="mt-1 text-sm text-ink-muted">
        차단한 사용자의 글과 댓글은 보이지 않아요. 언제든 해제할 수 있어요.
      </p>
      <BlockedList rows={rows} />
    </main>
  );
}
