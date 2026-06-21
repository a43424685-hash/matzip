"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ListPlus, Check, Plus, X, Lock } from "lucide-react";
import { markScrollReset } from "@/lib/scrollReset";

interface Col {
  id: string;
  title: string;
  itemCount: number;
  isPublic: boolean;
  hasRestaurant: boolean;
}

export default function CollectionPicker({
  restaurantId,
  isLoggedIn,
  compact = false,
}: {
  restaurantId: string;
  isLoggedIn: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [cols, setCols] = useState<Col[] | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch(`/api/collections?restaurantId=${restaurantId}`);
    if (res.status === 401) {
      markScrollReset();
      router.push(`/login?returnTo=${encodeURIComponent(pathname)}`);
      return;
    }
    const d = await res.json();
    setCols(d.collections);
  }

  function onOpen() {
    if (!isLoggedIn) {
      markScrollReset();
      router.push(`/login?returnTo=${encodeURIComponent(pathname)}`);
      return;
    }
    setOpen(true);
    setCols(null);
    load();
  }

  async function toggle(c: Col) {
    setBusy(true);
    const res = await fetch("/api/collections/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collectionId: c.id, restaurantId }),
    });
    if (res.ok) {
      const d = await res.json();
      setCols((prev) =>
        prev!.map((x) =>
          x.id === c.id
            ? { ...x, hasRestaurant: d.added, itemCount: x.itemCount + (d.added ? 1 : -1) }
            : x
        )
      );
    }
    setBusy(false);
  }

  async function createAndAdd() {
    if (!newTitle.trim()) return;
    setBusy(true);
    const res = await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle, restaurantId }),
    });
    if (res.ok) {
      setNewTitle("");
      await load();
    }
    setBusy(false);
  }

  return (
    <>
      <button
        onClick={onOpen}
        className={compact ? "btn-outline h-10 w-full !text-sm" : "btn-outline h-12 w-full !text-base"}
      >
        <ListPlus size={compact ? 15 : 18} /> {compact ? "리스트" : "내 리스트에 담기"}
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center">
          <div className="animate-fade-in absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="animate-sheet-up relative mx-auto w-full max-w-md rounded-t-3xl bg-white p-5 pb-8">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-extrabold text-ink">리스트에 담기</h3>
              <button onClick={() => setOpen(false)} className="text-stone-400">
                <X size={20} />
              </button>
            </div>

            {/* 새 리스트 */}
            <div className="mb-3 flex gap-2">
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="새 리스트 (예: 성수 데이트 맛집)"
                className="input h-11 flex-1"
              />
              <button
                onClick={createAndAdd}
                disabled={busy || !newTitle.trim()}
                className="btn-primary h-11 px-4"
              >
                <Plus size={16} /> 만들기
              </button>
            </div>

            {/* 목록 */}
            <div className="max-h-72 space-y-1.5 overflow-y-auto">
              {cols === null ? (
                <p className="py-6 text-center text-sm text-stone-400">불러오는 중…</p>
              ) : cols.length === 0 ? (
                <p className="py-6 text-center text-sm text-ink-muted">
                  아직 리스트가 없어요. 위에서 새로 만들어보세요.
                </p>
              ) : (
                cols.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => toggle(c)}
                    disabled={busy}
                    className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left ${
                      c.hasRestaurant ? "border-forest bg-forest-soft" : "border-stone-200 bg-white"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-ink">{c.title}</span>
                      {!c.isPublic && <Lock size={13} className="text-stone-400" />}
                      <span className="text-xs text-stone-400">{c.itemCount}곳</span>
                    </span>
                    {c.hasRestaurant && <Check size={18} className="text-forest" />}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
