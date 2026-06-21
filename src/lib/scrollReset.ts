// 내부 페이지 이동 시 "새 화면은 top에서 시작" 플래그.
// 클릭/라우터 이동 직전에 세팅 → 다음 route 진입에서 ScrollReset이 소비.
export const SCROLL_RESET_FLAG = "mgp:scroll-reset";

export function markScrollReset() {
  try {
    sessionStorage.setItem(SCROLL_RESET_FLAG, "1");
  } catch {
    // private/locked 컨텍스트에서 sessionStorage 불가 — 무시
  }
}
