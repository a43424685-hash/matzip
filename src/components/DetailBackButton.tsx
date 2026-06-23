"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { markScrollReset } from "@/lib/scrollReset";

export default function DetailBackButton({ floating = false }: { floating?: boolean }) {
  const router = useRouter();

  function goBack() {
    if (window.history.length > 1) {
      router.back();
    } else {
      markScrollReset();
      router.push("/");
    }
  }

  return (
    <button
      type="button"
      onClick={goBack}
      className={
        floating
          ? "absolute left-3 top-[calc(env(safe-area-inset-top)_+_0.75rem)] z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur"
          : "flex h-10 w-10 items-center justify-center rounded-full bg-stone-100 text-ink"
      }
      aria-label="뒤로가기"
    >
      <ArrowLeft size={22} />
    </button>
  );
}
