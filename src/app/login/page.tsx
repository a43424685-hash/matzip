import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; returnTo?: string }>;
}) {
  // 이미 로그인했으면 홈으로 (뒤로가기로 로그인 폼이 다시 뜨는 것 방지)
  if (await getCurrentUser()) redirect("/");
  const { error, returnTo } = await searchParams;
  return <LoginForm error={error} returnTo={returnTo} />;
}
