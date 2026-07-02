import { redirect } from "next/navigation";

// 닉네임+실명 통합 온보딩(/onboarding)으로 일원화됨. 옛 경로는 리다이렉트.
export default function LegacyNicknameOnboarding() {
  redirect("/onboarding");
}
