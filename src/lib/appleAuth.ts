/**
 * Sign in with Apple (웹 OAuth) 헬퍼.
 *  - client_secret: Apple 개발자 키(.p8, ES256)로 서명한 짧은 수명 JWT.
 *  - id_token: Apple 토큰 응답에 담긴 JWT(서명은 appleid.apple.com과의 직접 HTTPS 교환으로 신뢰) → payload 디코드.
 *
 * 필요 환경변수:
 *   APPLE_CLIENT_ID   서비스 ID (예: com.codebueok.mukgopin.signin)
 *   APPLE_TEAM_ID     개발자 팀 ID
 *   APPLE_KEY_ID      Sign in with Apple 키의 Key ID
 *   APPLE_PRIVATE_KEY .p8 파일 내용 (개행은 실제 줄바꿈 또는 \n 둘 다 허용)
 */

import { createPrivateKey, sign as cryptoSign } from "crypto";

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

/** Apple 토큰 요청에 쓰는 client_secret(JWT) 생성. */
export function makeAppleClientSecret(): string {
  const teamId = process.env.APPLE_TEAM_ID;
  const clientId = process.env.APPLE_CLIENT_ID;
  const keyId = process.env.APPLE_KEY_ID;
  const privateKeyPem = (process.env.APPLE_PRIVATE_KEY || "").replace(/\\n/g, "\n").trim();
  if (!teamId || !clientId || !keyId || !privateKeyPem) {
    throw new Error("Apple 환경변수(APPLE_TEAM_ID/CLIENT_ID/KEY_ID/PRIVATE_KEY) 누락");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", kid: keyId };
  const payload = {
    iss: teamId,
    iat: now,
    exp: now + 60 * 5, // 토큰 교환 직전에만 쓰므로 5분이면 충분
    aud: "https://appleid.apple.com",
    sub: clientId,
  };

  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const key = createPrivateKey(privateKeyPem);
  // ES256 JWT 서명은 raw R||S(64바이트) 형식이어야 함 → ieee-p1363
  const signature = cryptoSign("sha256", Buffer.from(signingInput), { key, dsaEncoding: "ieee-p1363" });
  return `${signingInput}.${base64url(signature)}`;
}

export interface AppleIdTokenClaims {
  sub?: string;
  email?: string;
  email_verified?: boolean | string;
}

/** id_token(JWT) payload 디코드. (서명은 직접 HTTPS 토큰교환으로 신뢰) */
export function decodeAppleIdToken(idToken: string): AppleIdTokenClaims {
  const parts = idToken.split(".");
  if (parts.length < 2) return {};
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as AppleIdTokenClaims;
  } catch {
    return {};
  }
}
