import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[72vh] flex-col items-center justify-center px-6 text-center">
      <p className="text-5xl" aria-hidden>🍽️</p>
      <h1 className="mt-4 text-lg font-extrabold text-ink">찾을 수 없는 페이지예요</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        삭제됐거나, 차단한 사용자의 글이거나,
        <br />
        주소가 바뀌었을 수 있어요.
      </p>
      <Link href="/" className="btn-primary mt-6 h-11 px-6">
        홈으로 가기
      </Link>
    </main>
  );
}
