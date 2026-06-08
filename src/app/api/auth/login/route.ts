import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "로그인 정보를 다시 입력해주세요." },
      { status: 400 }
    );
  }

  const data = body as { email?: unknown; password?: unknown };
  const email = String(data.email ?? "").trim().toLowerCase();
  const password = String(data.password ?? "");

  if (!email || !password) {
    return NextResponse.json(
      { ok: false, error: "이메일과 비밀번호를 입력해주세요." },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json(
      { ok: false, error: "이메일 또는 비밀번호가 올바르지 않습니다." },
      { status: 401 }
    );
  }

  if (!user.emailVerifiedAt) {
    return NextResponse.json(
      { ok: false, error: "이메일 인증 후 로그인할 수 있습니다." },
      { status: 403 }
    );
  }

  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
