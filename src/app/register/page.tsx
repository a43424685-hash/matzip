import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getActiveRegions, getActiveCategories, groupCategoriesByType } from "@/server/catalog";
import RegisterForm from "@/components/RegisterForm";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [regions, categories] = await Promise.all([
    getActiveRegions(),
    getActiveCategories(),
  ]);
  const groups = groupCategoriesByType(categories);

  return (
    <main className="px-5 py-6">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-ink">맛집 등록</h1>
        <Link href="/" className="text-sm text-stone-400">
          닫기
        </Link>
      </div>
      <p className="mb-6 text-sm text-ink-muted">
        필수는 <b className="text-ink">상호명 · 지역 · 카테고리</b>. 더 채울수록 XP가 쌓여요.
      </p>
      <RegisterForm regions={regions} categoryGroups={groups} />
    </main>
  );
}
