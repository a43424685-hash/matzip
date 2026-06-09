import { MapPin } from "lucide-react";
import MeSubPageHeader from "@/components/MeSubPageHeader";

export const dynamic = "force-dynamic";

export default function LocationHelpPage() {
  return (
    <main className="px-5 pb-24 pt-5">
      <MeSubPageHeader title="위치 권한 안내" />

      <div className="flex items-center gap-2 rounded-2xl bg-forest-soft/40 p-4">
        <MapPin size={18} className="text-forest" />
        <p className="text-[13px] font-semibold text-ink">
          맛집 위치 인증·내 주변 지도를 쓰려면 위치 권한이 필요해요.
        </p>
      </div>

      <section className="mt-5">
        <h2 className="mb-2 text-sm font-bold text-stone-400">아이폰 (Safari)</h2>
        <ol className="space-y-1.5 text-[13px] leading-relaxed text-ink-muted">
          <li>1. 설정 → 개인정보 보호 및 보안 → 위치 서비스 켜기</li>
          <li>2. 설정 → Safari → 위치 → “확인” 또는 “허용”</li>
          <li>3. 사이트에서 위치 요청이 뜨면 “허용”</li>
        </ol>
      </section>

      <section className="mt-5">
        <h2 className="mb-2 text-sm font-bold text-stone-400">안드로이드 (Chrome)</h2>
        <ol className="space-y-1.5 text-[13px] leading-relaxed text-ink-muted">
          <li>1. 설정 → 위치 → 켜기</li>
          <li>2. Chrome → 설정 → 사이트 설정 → 위치 → 허용</li>
          <li>3. 사이트에서 위치 요청이 뜨면 “허용”</li>
        </ol>
      </section>

      <p className="mt-5 rounded-2xl bg-stone-50 p-4 text-[12px] text-stone-400">
        위치 인증은 가게 50m 이내 + GPS 정확도가 좋은 야외에서 가장 잘 돼요. 실내·지하에서는 정확도가 떨어질 수 있어요.
      </p>
    </main>
  );
}
