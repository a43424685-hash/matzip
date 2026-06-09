import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import MeSubPageHeader from "@/components/MeSubPageHeader";

export const dynamic = "force-dynamic";

function ago(d: Date): string {
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return `${Math.floor(s / 86400)}일 전`;
}

export default async function MySharedPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const shares = await prisma.postShare.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      createdAt: true,
      post: {
        select: {
          id: true,
          locationVerified: true,
          restaurant: { select: { name: true } },
          user: { select: { nickname: true } },
        },
      },
    },
  });

  return (
    <main className="px-5 pb-24 pt-5">
      <MeSubPageHeader title={`공유한 맛집 (${shares.length})`} />
      {shares.length === 0 ? (
        <p className="mt-10 rounded-2xl bg-stone-50 py-12 text-center text-sm text-stone-400">
          아직 공유한 맛집이 없어요.
        </p>
      ) : (
        <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200/80">
          {shares.map((s, i) => (
            <li key={i}>
              <Link href={`/restaurants/${s.post.id}`} className="flex items-center gap-3 bg-white px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-bold text-ink">{s.post.restaurant.name}</span>
                    {s.post.locationVerified && <ShieldCheck size={13} className="shrink-0 text-forest" />}
                  </div>
                  <div className="truncate text-[12px] text-stone-400">by {s.post.user.nickname}</div>
                </div>
                <span className="shrink-0 text-[11px] text-stone-400">{ago(s.createdAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
