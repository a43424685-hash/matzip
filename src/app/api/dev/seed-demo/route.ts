import { NextResponse } from "next/server";
import { getSessionAdmin } from "@/lib/auth";
import { runDemoSeed, cleanDemo } from "@/server/dev/demoSeed";

export const dynamic = "force-dynamic";

// 운영자만 트리거 가능한 데모 데이터 시드.
//   채우기:  /api/dev/seed-demo
//   지우기:  /api/dev/seed-demo?clean=1
export async function GET(req: Request) {
  const admin = await getSessionAdmin();
  if (!admin?.isAdmin) {
    return NextResponse.json(
      { ok: false, error: "운영자 계정으로 로그인 후 다시 시도하세요." },
      { status: 403 }
    );
  }

  const clean = new URL(req.url).searchParams.get("clean") === "1";
  try {
    if (clean) {
      await cleanDemo();
      return NextResponse.json({ ok: true, cleaned: true });
    }
    const result = await runDemoSeed();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[seed-demo]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
