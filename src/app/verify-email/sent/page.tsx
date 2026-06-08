import Link from "next/link";

export default async function VerifyEmailSentPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; devUrl?: string }>;
}) {
  const { email, devUrl } = await searchParams;

  return (
    <main className="px-5 py-10">
      <h1 className="text-2xl font-extrabold">이메일을 확인해주세요</h1>
      <p className="mt-2 text-sm text-neutral-500">
        {email ? `${email} 로 인증 링크를 보냈어요.` : "인증 링크를 보냈어요."}
        <br />
        링크를 누르면 가입이 완료됩니다.
      </p>

      {devUrl && (
        <div className="mt-6 rounded-2xl border border-forest/20 bg-forest-soft/30 p-4">
          <p className="text-xs font-semibold text-forest">개발용 인증 링크</p>
          <Link href={devUrl} className="mt-2 block break-all text-sm font-semibold text-ink">
            {devUrl}
          </Link>
        </div>
      )}

      <Link href="/login" className="btn-ghost mt-8 w-full">
        로그인으로 돌아가기
      </Link>
    </main>
  );
}
