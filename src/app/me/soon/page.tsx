import { Hammer } from "lucide-react";
import BackHomeHeader from "@/components/BackHomeHeader";

export const dynamic = "force-dynamic";

export default async function SoonPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  return (
    <main className="px-5 py-6">
      <BackHomeHeader title={t || "준비 중"} />
      <div className="mt-16 flex flex-col items-center gap-3 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-stone-100 text-stone-400">
          <Hammer size={28} />
        </div>
        <p className="text-base font-bold text-ink">곧 만나요</p>
        <p className="text-sm text-ink-muted">아직 준비 중인 기능이에요. 조금만 기다려주세요.</p>
      </div>
    </main>
  );
}
