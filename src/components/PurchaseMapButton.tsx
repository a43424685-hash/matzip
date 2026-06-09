"use client";

import { Lock } from "lucide-react";

export default function PurchaseMapButton({ priceWon }: { priceWon: number | null }) {
  return (
    <button
      onClick={() => alert("결제 기능을 준비 중이에요. 곧 열려요!")}
      className="btn-primary h-12 w-full !text-base"
    >
      <Lock size={17} /> {priceWon ? `${priceWon.toLocaleString()}원 구매하고 전체 보기` : "구매하고 전체 보기"}
    </button>
  );
}
