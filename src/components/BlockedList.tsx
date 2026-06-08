"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BlockedUserRow } from "@/server/block/BlockService";

export default function BlockedList({ rows }: { rows: BlockedUserRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function unblock(id: string) {
    setBusy(id);
    await fetch("/api/blocks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockedId: id }),
    });
    setBusy(null);
    router.refresh();
  }

  if (rows.length === 0) {
    return (
      <p className="mt-6 rounded-2xl bg-stone-50 py-10 text-center text-sm text-stone-400">
        차단한 사용자가 없어요.
      </p>
    );
  }

  return (
    <ul className="mt-4 divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200/80">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center justify-between bg-white px-4 py-3">
          <span className="flex items-center gap-2 text-sm">
            <span className="badge-lv">Lv.{r.level}</span>
            <b className="text-ink">{r.nickname}</b>
          </span>
          <button
            type="button"
            disabled={busy === r.id}
            onClick={() => unblock(r.id)}
            className="rounded-lg border border-stone-200 px-3 py-1.5 text-[13px] font-semibold text-ink active:scale-95 disabled:opacity-50"
          >
            차단 해제
          </button>
        </li>
      ))}
    </ul>
  );
}
