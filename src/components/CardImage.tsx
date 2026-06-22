"use client";

import { useState } from "react";
import { Store } from "lucide-react";

/**
 * 이미지 카드용 — 로드 실패(깨진 URL) 시 큰 빈/깨진 박스 대신
 * 세련된 간판형 placeholder 로 대체한다.
 */
export default function CardImage({
  src,
  alt,
  className = "",
  label,
}: {
  src: string;
  alt: string;
  className?: string;
  label?: string;
}) {
  const [errored, setErrored] = useState(false);

  if (errored) {
    return (
      <div
        className={`thumb-empty flex flex-col items-center justify-center gap-1.5 text-forest/40 ${className}`}
      >
        <Store size={32} strokeWidth={1.6} />
        {label && <span className="text-xs font-medium">{label}</span>}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => setErrored(true)}
    />
  );
}
