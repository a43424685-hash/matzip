/**
 * XP 지급표 — 명세 6.3 기준. 모든 XP 금액은 여기 한 곳에서 관리한다.
 * (밸런스 조정 시 이 파일만 수정)
 */

export type XpSourceType =
  // 기록 작성 — 위치 인증 전까지 "보류", 위치 인증 시 일괄 지급
  | "post_created" // 기본 기록(상호명·지역)
  | "photo_added" // 등록 사진(음식/가게 전경/메뉴/분위기). 별도 음식 인증사진은 폐지.
  | "video_added"
  | "short_review"
  | "detail_review"
  | "categories"
  | "price"
  | "waiting"
  | "revisit"
  | "menu_recommend"
  // 인증 (위치 인증이 중심, 나머지는 신뢰 보너스)
  | "location_verified" // 위치 인증 — XP의 중심
  | "receipt_verified" // 영수증 (강한 증거 → 높게)
  | "menu_verified" // 메뉴판
  | "full_verify_bonus" // 위치+영수증+메뉴판 3종 풀인증
  // 반응 (인증된 맛집에만 지급)
  | "like_received"
  | "saved_by_user"
  | "shared"
  | "comment_received"
  | "video_views"
  // 장기 활동 / 마일스톤
  | "daily_first_verify" // 오늘 첫 인증
  | "region_5_verified" // 같은 지역 인증 5곳
  | "region_10_verified" // 같은 지역 인증 10곳
  | "streak_7d"
  | "clean_30d"
  // 커뮤니티
  | "community_answer_accepted"; // Q&A 답변 채택됨 (맛집카드 첨부·자기채택제외·1일상한)

export const XP_AMOUNT: Record<XpSourceType, number> = {
  // 기록(보류 → 위치 인증 시 지급)
  post_created: 50, // 기본 기록
  photo_added: 50, // 등록 사진
  video_added: 80,
  short_review: 40,
  detail_review: 70,
  categories: 30, // 카테고리 3개 이상
  price: 10,
  waiting: 10,
  revisit: 10,
  menu_recommend: 30,
  // 인증
  location_verified: 150, // 중심
  receipt_verified: 100, // 강한 증거
  menu_verified: 40,
  full_verify_bonus: 150, // 3종 풀인증(위치+영수증+메뉴판)
  // 반응 (인증글만)
  like_received: 10,
  saved_by_user: 25,
  shared: 40,
  comment_received: 10,
  video_views: 50,
  // 장기/마일스톤
  daily_first_verify: 50, // 오늘 첫 인증
  region_5_verified: 200,
  region_10_verified: 500,
  streak_7d: 500,
  clean_30d: 1000,
  // 커뮤니티 — 인증(150)보다 작고, 1일 상한과 결합해 커뮤니티만으로 레벨 우회 방지
  community_answer_accepted: 25,
};

/**
 * 이번 주 인기 맛집 — 음식점 반응 점수 가중치 (명세 5.3)
 */
export const REACTION_WEIGHT = {
  like: 1,
  save: 3,
  share: 5,
  visit_proof: 10,
  video_view: 0.1,
} as const;

/**
 * 어뷰징 방지 한도 (명세 6.4)
 */
export const ABUSE_LIMITS = {
  // 하루 맛집 등록 기본 XP는 최대 10건까지만
  dailyPostBaseXpCap: 10,
  // 같은 사용자 A→B 좋아요 XP는 하루 최대 3개까지만 인정 (감쇠)
  likeFromSameActorDailyCap: 3,
  // 한 사용자가 하루에 발생시킬 수 있는 공유 XP 이벤트 상한 (파밍 방지)
  dailyShareXpCap: 20,
  // 증거 인증(특히 영수증 AI) 비용/어뷰징 상한 — 모두 AI 호출 "전에" 검사 (실패도 카운트)
  proofAttemptsPerSlot: 5, // 한 글의 한 항목(사진/영수증/메뉴)당 시도 최대치
  proofAttemptsPerUserPerDay: 30, // 한 사용자 하루 증거 인증 시도 최대치
  maxProofImageChars: 1_000_000, // data URL 길이 상한(≈ 750KB) — 토큰 폭탄 차단
  // 댓글 도배 방지 (댓글은 경험치 없음)
  dailyCommentCap: 50, // 한 사용자 하루 댓글/답글 최대
  maxCommentLength: 1000, // 댓글 글자 수 상한
};

/**
 * ── XP 정책 구조 (수치 미확정) ──
 * 어떤 행동이 XP 지급 대상인지의 "구조"만 먼저 확정한다.
 * 실제 수치/게이팅은 추후 확정 후 XpService.awardXp 에 연결한다.
 * (현재 라이브 지급 로직/수치는 변경하지 않음 — 숫자 확정 전이므로)
 *
 * 핵심 방향:
 *  - 리스트 생성/담기/저장: XP 없음 (순수 큐레이션·개인 활동)
 *  - 미인증 맛집 기록: XP 제한 또는 없음
 *  - 인증된 맛집 기록: XP 지급 대상
 *  - 인증 뱃지(위치/영수증/메뉴판)가 많을수록 신뢰도↑ → 보너스 가능
 */
export const XP_ELIGIBILITY = {
  collectionCreate: false, // 리스트 생성
  collectionAddItem: false, // 리스트에 담기
  save: false, // 저장
  unverifiedPost: false, // 미인증 맛집 기록 (false = 미지급 방향, 추후 확정)
  verifiedPost: true, // 인증된 맛집 기록 (지급 대상)
} as const;

/**
 * 인증 뱃지 수(0~3: 위치/영수증/메뉴판)별 신뢰도/보너스 배수 — 전부 1 = 아직 미적용 placeholder.
 * 추후 확정 시 awardXp 결과에 곱해 "인증 많을수록 더 많이" 를 구현한다.
 */
export const VERIFICATION_BONUS_MULTIPLIER: Record<number, number> = {
  0: 1,
  1: 1,
  2: 1,
  3: 1,
};
