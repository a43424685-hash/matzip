import Link from "next/link";
import { verifyEmailToken } from "@/server/auth/EmailVerificationService";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const result = token ? await verifyEmailToken(token) : { ok: false as const };

  return (
    <main className="px-5 py-10">
      <h1 className="text-2xl font-extrabold">
        {result.ok ? "이메일 인증 완료" : "인증 링크를 확인해주세요"}
      </h1>
      <p className="mt-2 text-sm text-neutral-500">
        {result.ok
          ? "이제 로그인해서 맛집 레벨을 올릴 수 있어요."
          : "링크가 만료됐거나 이미 사용됐어요. 다시 회원가입하거나 새 인증 링크를 요청해주세요."}
      </p>
      <Link href="/login" className="btn-primary mt-8 w-full">
        로그인하기
      </Link>
    </main>
  );
}
