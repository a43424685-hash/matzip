import { redirect } from "next/navigation";
import Link from "next/link";
import { X } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import CommunityWriteForm from "@/components/community/CommunityWriteForm";

export const dynamic = "force-dynamic";

export default async function CommunityWritePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?returnTo=/community/write");
  const sp = await searchParams;

  return (
    <main className="px-5 py-6">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-ink">글쓰기</h1>
        <Link href="/community" aria-label="닫기" className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-ink active:scale-95">
          <X size={20} strokeWidth={2.4} />
        </Link>
      </div>
      <CommunityWriteForm initialCategory={sp.cat} />
    </main>
  );
}
