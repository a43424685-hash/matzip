/**
 * OAuth CSRF 방어 — state에 난수 nonce를 넣고, 같은 값을 HttpOnly 쿠키에 심는다.
 * 콜백에서 state의 nonce와 쿠키의 nonce를 상수시간 비교해 일치할 때만 통과.
 * (공격자가 자기 code로 피해자를 로그인시키는 로그인 CSRF 차단)
 *
 * returnTo/native는 보안값이 아니라 흐름 정보라 state에 같이 싣되,
 * 인가 판단은 오직 nonce 일치로만 한다.
 */
import { randomBytes, timingSafeEqual } from "crypto";

export const OAUTH_STATE_COOKIE = "mgp_oauth_state";
const SEP = ".";

export function newNonce(): string {
  return randomBytes(16).toString("hex"); // 128-bit
}

/** state 문자열 조립: nonce.flags.returnTo(URL인코딩) */
export function buildState(nonce: string, native: boolean, returnTo: string): string {
  return `${nonce}${SEP}${native ? "1" : "0"}${SEP}${encodeURIComponent(returnTo || "")}`;
}

export function parseState(state: string): { nonce: string; native: boolean; returnTo: string } {
  const i1 = state.indexOf(SEP);
  const i2 = state.indexOf(SEP, i1 + 1);
  if (i1 < 0 || i2 < 0) return { nonce: "", native: false, returnTo: "/" };
  const nonce = state.slice(0, i1);
  const native = state.slice(i1 + 1, i2) === "1";
  let returnTo = "/";
  try {
    const rt = decodeURIComponent(state.slice(i2 + 1));
    returnTo = rt.startsWith("/") && !rt.startsWith("//") ? rt : "/";
  } catch {
    returnTo = "/";
  }
  return { nonce, native, returnTo };
}

/** state의 nonce와 쿠키의 nonce가 일치하는지 (상수시간) */
export function verifyNonce(stateNonce: string | undefined, cookieNonce: string | undefined): boolean {
  if (!stateNonce || !cookieNonce) return false;
  const a = Buffer.from(stateNonce);
  const b = Buffer.from(cookieNonce);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * state 쿠키 옵션 (10분, HttpOnly).
 * @param crossSitePost Apple 처럼 form_post(교차 출처 POST)로 콜백을 받는 경우 true.
 *   교차 출처 POST엔 SameSite=Lax 쿠키가 안 실리므로 None+Secure로 보내야 한다.
 *   (카카오는 GET 리다이렉트 콜백이라 Lax로 충분)
 */
export function stateCookieOptions(crossSitePost = false) {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd || crossSitePost, // SameSite=None 은 Secure 필수
    sameSite: crossSitePost ? ("none" as const) : ("lax" as const),
    path: "/",
    maxAge: 600,
  };
}
