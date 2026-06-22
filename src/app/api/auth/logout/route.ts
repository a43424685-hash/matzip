import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

// 로그아웃 — 세션 쿠키 제거. 클라이언트가 호출 후 하드 이동(window.location)으로 홈 새로고침.
export async function POST() {
  await destroySession();
  return NextResponse.json({ ok: true });
}
