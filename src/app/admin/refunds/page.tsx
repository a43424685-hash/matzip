import { RotateCcw } from "lucide-react";

export const dynamic = "force-dynamic";

export default function AdminRefundsPage() {
  return (
    <div>
      <h1 className="flex items-center gap-2 text-xl font-black text-ink">
        <RotateCcw size={20} className="text-forest" /> 환불 관리
      </h1>
      <p className="mt-4 rounded-2xl border border-stone-200 bg-white p-5 text-sm leading-relaxed text-ink-muted">
        환불 기능은 다음 단계에서 붙여요. 들어올 내용:
        <br />· 결제 건 검색 → <b className="text-ink">환불</b> 버튼 (포트원 결제 취소 자동 호출)
        <br />· 환불 시 구매자 접근 회수 + 판매자 정산에서 자동 차감
      </p>
    </div>
  );
}
