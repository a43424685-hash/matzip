import { redirect } from "next/navigation";
import { ChevronDown, Mail, MessageSquare } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import MeSubPageHeader from "@/components/MeSubPageHeader";

export const dynamic = "force-dynamic";

const FAQ = [
  {
    q: "위치 인증이 안 돼요",
    a: "현장에서 가게와 가까운 거리(약 50m 이내)에서, GPS 정확도가 좋은 상태로 인증해야 해요. 실내에서는 정확도가 떨어질 수 있으니 가게 앞에서 시도해보세요.",
  },
  {
    q: "사진 업로드가 안 돼요",
    a: "사진은 jpg·png·webp만 가능하고 용량 제한이 있어요. 영상은 mp4·mov·webm, 최대 60초·50MB까지 올릴 수 있어요.",
  },
  {
    q: "유료 맛집지도는 어떻게 열 수 있나요",
    a: "Lv.20 이상이고 위치 인증 맛집이 30곳 이상(그중 5곳은 영수증·메뉴 인증 포함)이면 열 수 있어요. 맛보기 가게 5곳을 직접 고른 뒤 판매를 켜면 돼요. 내 정보 > 유료 맛집지도 관리에서 진행 상황을 확인하세요.",
  },
  {
    q: "거짓 리뷰는 어떻게 신고하나요",
    a: "맛집 상세 화면이나 댓글의 ‘신고’ 버튼으로 신고할 수 있어요. 운영팀이 확인 후 조치해요.",
  },
];

export default async function SupportPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <main className="px-5 pb-24 pt-5">
      <MeSubPageHeader title="고객센터" />

      <h2 className="mb-2 text-sm font-bold text-stone-400">자주 묻는 질문</h2>
      <div className="space-y-2">
        {FAQ.map((f) => (
          <details key={f.q} className="rounded-2xl border border-stone-200">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3.5 text-sm font-bold text-ink">
              {f.q}
              <ChevronDown size={16} className="text-stone-400" />
            </summary>
            <p className="px-4 pb-4 text-[13px] leading-relaxed text-ink-muted">{f.a}</p>
          </details>
        ))}
      </div>

      <h2 className="mb-2 mt-7 text-sm font-bold text-stone-400">문의하기</h2>
      <div className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200/80">
        <div className="flex items-center gap-3 bg-white px-4 py-3.5 text-sm text-ink">
          <Mail size={18} className="text-stone-400" /> 이메일 문의
          <span className="ml-auto text-[12px] text-stone-400">준비중</span>
        </div>
        <div className="flex items-center gap-3 bg-white px-4 py-3.5 text-sm text-ink">
          <MessageSquare size={18} className="text-stone-400" /> 카카오 채널
          <span className="ml-auto text-[12px] text-stone-400">준비중</span>
        </div>
      </div>
    </main>
  );
}
