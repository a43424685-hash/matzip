import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { BUSINESS } from "@/lib/businessInfo";

/**
 * 화면 하단 사업자정보 + 법적 링크 (전자상거래법 의무 표시).
 * 사업자 정보는 여기어때처럼 접이식(<details>)으로 두되, 내용은 항상 DOM에 있어
 * 크롤러/심사가 그대로 읽을 수 있음.
 */
export default function SiteFooter() {
  return (
    <footer className="mt-10 border-t border-stone-100 bg-stone-50 px-5 py-6 text-[12px] leading-relaxed text-stone-500">
      {/* 법적 링크 — 항상 노출 */}
      <nav className="flex flex-wrap gap-x-3 gap-y-1.5 font-semibold text-stone-600">
        <Link href="/terms" className="hover:text-forest">이용약관</Link>
        <span className="text-stone-300">·</span>
        <Link href="/privacy" className="font-bold text-stone-700 hover:text-forest">개인정보처리방침</Link>
        <span className="text-stone-300">·</span>
        <Link href="/refund" className="hover:text-forest">환불·취소정책</Link>
        <span className="text-stone-300">·</span>
        <Link href="/store" className="hover:text-forest">상품 안내</Link>
      </nav>

      {/* 사업자 정보 — 접이식 */}
      <details className="group mt-4">
        <summary className="flex cursor-pointer list-none items-center justify-between font-bold text-stone-600 [&::-webkit-details-marker]:hidden">
          <span className="brand-logo text-[18px] leading-none text-stone-400">
            <span>먹고</span>
            <span className="brand-logo-point">핀</span>
          </span>
          <span className="flex items-center gap-1">
            사업자 정보
            <ChevronDown size={14} className="transition-transform group-open:rotate-180" />
          </span>
        </summary>

        <dl className="mt-3 space-y-0.5">
          <div className="flex flex-wrap gap-x-1.5">
            <dt className="text-stone-400">상호</dt>
            <dd>{BUSINESS.company}</dd>
            <span className="text-stone-300">|</span>
            <dt className="text-stone-400">대표</dt>
            <dd>{BUSINESS.owner}</dd>
          </div>
          <div className="flex flex-wrap gap-x-1.5">
            <dt className="text-stone-400">사업자등록번호</dt>
            <dd>{BUSINESS.bizRegNo}</dd>
          </div>
          <div className="flex flex-wrap gap-x-1.5">
            <dt className="text-stone-400">통신판매업신고</dt>
            <dd>{BUSINESS.mailOrderNo}</dd>
          </div>
          <div className="flex flex-wrap gap-x-1.5">
            <dt className="text-stone-400">주소</dt>
            <dd>{BUSINESS.address}</dd>
          </div>
          <div className="flex flex-wrap gap-x-1.5">
            <dt className="text-stone-400">전화</dt>
            <dd>
              <a href={`tel:${BUSINESS.phone.replace(/-/g, "")}`} className="hover:text-forest">{BUSINESS.phone}</a>
            </dd>
            <span className="text-stone-300">|</span>
            <dt className="text-stone-400">이메일</dt>
            <dd>
              <a href={`mailto:${BUSINESS.email}`} className="hover:text-forest">{BUSINESS.email}</a>
            </dd>
          </div>
        </dl>

        <p className="mt-3 text-stone-400">
          {BUSINESS.serviceName} 서비스 내 유료 맛집 지도에는 회원이 직접 판매하는 상품이 포함됩니다. 개별 판매자가
          판매하는 상품의 경우 {BUSINESS.company}는 통신판매중개자로서 거래·환불 등의 책임은 각 판매자에게 있을 수
          있습니다.
        </p>
      </details>

      <p className="mt-3 text-stone-400">© {BUSINESS.company}</p>
    </footer>
  );
}
