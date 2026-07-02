/**
 * 가벼운 RBAC — 어드민 액션별 권한.
 * isAdmin = 어드민 접근 게이트(직원 여부). role = 그 안에서 무슨 액션을 할 수 있나.
 * 지금은 운영자 1명(superadmin)이라 동작은 동일하나, 직원이 생기면 role 만 바꾸면 분리됨.
 */
export type Role = "superadmin" | "settlement" | "support" | "none";

export type Permission =
  | "settlement" // 정산/출금 처리
  | "refund" // 환불 처리
  | "report" // 신고 처리
  | "member_view" // 회원 조회(360뷰)
  | "member_sanction"; // 회원 제재(정지/해제/메모)

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  superadmin: ["settlement", "refund", "report", "member_view", "member_sanction"],
  settlement: ["settlement", "refund", "member_view"],
  support: ["report", "member_view", "member_sanction"],
  none: [],
};

/** role 이 perm 권한을 갖는지. superadmin 은 전부 허용. */
export function can(role: string | null | undefined, perm: Permission): boolean {
  if (role === "superadmin") return true;
  const perms = ROLE_PERMISSIONS[(role as Role) ?? "none"];
  return perms ? perms.includes(perm) : false;
}
