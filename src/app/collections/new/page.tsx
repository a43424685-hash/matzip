import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getActiveRegions } from "@/server/catalog";
import CollectionCreateForm from "@/components/CollectionCreateForm";

export const dynamic = "force-dynamic";

export default async function NewCollectionPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const regions = await getActiveRegions();

  return (
    <main className="px-5 py-6">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-ink">새 맛집 리스트</h1>
        <Link href="/me" className="text-sm text-stone-400">
          닫기
        </Link>
      </div>
      <p className="mb-6 text-sm text-ink-muted">
        맛집을 묶어 나만의 컬렉션을 만들고 공유해보세요.
      </p>
      <CollectionCreateForm regions={regions} />
    </main>
  );
}
