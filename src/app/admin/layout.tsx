import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import AdminNav from "@/components/admin/AdminNav";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) notFound();

  return (
    <div className="min-h-dvh bg-stone-50">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-white px-5 py-3">
        <div className="flex items-center justify-between">
          <Link href="/admin" className="text-lg font-black text-forest">
            먹고핀 관리자
          </Link>
          <Link href="/" className="text-[13px] font-semibold text-stone-400">
            앱으로 →
          </Link>
        </div>
        <AdminNav />
      </header>
      <main className="mx-auto max-w-3xl px-4 py-5 md:px-6">{children}</main>
    </div>
  );
}
