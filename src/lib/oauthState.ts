/**
 * OAuth CSRF 방어 — state에 난수 nonce를 넣고, 같은 값을 HttpOnly 쿠키에 심는다.
 * 콜백에서 state의 nonce와 쿠키의 nonce를 상수시간 비교해 일치할 때만 통과.
 * (공격자가 자기 code로 피해자를 로그인시키는 로그인 CSRF 차단)
 *
 * 추가로 state 전체(nonce·native·returnTo)를 AUTH_SECRET 으로 HMAC 서명해,
 * native 플래그·returnTo 변조를 막는다. 프로바이더별로 쿠키 이름을 분리해
 * 카카오/애플 로그인 탭이 서로의 state 쿠키를 덮어쓰지 않게 한다.
 */
import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const SEP = ".";

/** 프로바이더별 state 쿠키 이름 (동시 로그인 탭 간 덮어쓰기 방지) */
export function stateCookieName(provider: "kakao" | "apple"): string {
  return `mgp_oauth_${provider}`;
}

function secret(): string {
  return process.env.AUTH_SECRET || "dev-insecure-secret";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function newNonce(): string {
  return randomBytes(16).toString("hex"); // 128-bit
}

/** state 문자열 조립: nonce.flags.returnTo(URL인코딩).sig */
export function buildState(nonce: string, native: boolean, returnTo: string): string {
  const payload = `${nonce}${SEP}${native ? "1" : "0"}${SEP}${encodeURIComponent(returnTo || "")}`;
  return `${payload}${SEP}${sign(payload)}`;
}

/** state 파싱 + 서명 검증. 서명이 안 맞으면 valid:false. */
export function parseState(state: string): {
  valid: boolean;
  nonce: string;
  native: boolean;
  returnTo: string;
} {
  const invalid = { valid: false, nonce: "", native: false, returnTo: "/" };
  const parts = state.split(SEP);
  if (parts.length !== 4) return invalid;
  const [nonce, flags, rtEnc, sig] = parts;
  const payload = `${nonce}${SEP}${flags}${SEP}${rtEnc}`;
  const expected = sign(payload);
  // 서명 상수시간 비교 (변조 차단)
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return invalid;
  }
  let returnTo = "/";
  try {
    const rt = decodeURIComponent(rtEnc);
    returnTo = rt.startsWith("/") && !rt.startsWith("//") ? rt : "/";
  } catch {
    returnTo = "/";
  }
  return { valid: true, nonce, native: flags === "1", returnTo };
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
 */
export function stateCookieOptions(crossSitePost = false) {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd || crossSitePost,
    sameSite: crossSitePost ? ("none" as const) : ("lax" as const),
    path: "/",
    maxAge: 600,
  };
}
