import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import SignupForm from "@/components/SignupForm";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  // 이미 로그인했으면 홈으로 (뒤로가기로 가입 폼이 다시 뜨는 것 방지)
  if (await getCurrentUser()) redirect("/");
  return <SignupForm />;
}
