/**
 * 민감정보(계좌번호) 저장용 대칭키 암호화 — AES-256-GCM.
 *
 *  - 키: 환경변수 ACCOUNT_ENC_KEY (32바이트를 base64 로 인코딩한 값).
 *        생성 예: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 *  - 저장 형식: "enc:v1:" + base64(iv(12) | authTag(16) | ciphertext)
 *  - 하위호환: "enc:" 접두어가 없으면 예전 평문으로 간주하고 그대로 반환한다.
 *    (키 도입 이전에 저장된 계좌가 있어도 화면이 깨지지 않게 하기 위함. 다음 저장 때 암호화됨.)
 */
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const PREFIX = "enc:v1:";

function getKey(): Buffer {
  const raw = process.env.ACCOUNT_ENC_KEY;
  if (!raw) {
    throw new Error(
      "ACCOUNT_ENC_KEY 환경변수가 없습니다. 정산 계좌 암호화 키를 설정하세요."
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("ACCOUNT_ENC_KEY 는 32바이트(base64) 여야 합니다.");
  }
  return key;
}

/** 평문 → 암호문("enc:v1:..."). 빈 값이면 그대로 반환. */
export function encryptField(plain: string): string {
  if (!plain) return plain;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, enc]).toString("base64");
}

/** 암호문 → 평문. 접두어 없는 예전 평문은 그대로 반환(하위호환). */
export function decryptField(stored: string | null | undefined): string {
  if (!stored) return "";
  if (!stored.startsWith(PREFIX)) return stored; // 레거시 평문
  const buf = Buffer.from(stored.slice(PREFIX.length), "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

/** 이미 암호화(enc:) 되어 있는지 */
export function isEncrypted(stored: string | null | undefined): boolean {
  return !!stored && stored.startsWith(PREFIX);
}

/**
 * 계좌번호 마스킹 — 앞 3, 뒤 3 자리만 노출. 예: 3333-01-1234567 → 333***…*567
 * 화면·CSV(운영자 외) 노출용. 실제 이체가 필요한 운영자 정산 화면은 원문을 쓴다.
 */
export function maskAccountNumber(plain: string): string {
  const digits = plain.replace(/[^0-9]/g, "");
  if (digits.length <= 6) return "*".repeat(digits.length);
  return `${digits.slice(0, 3)}${"*".repeat(digits.length - 6)}${digits.slice(-3)}`;
}

/** 이름 마스킹 — 홍길동 → 홍*동, 김철 → 김* */
export function maskName(name: string): string {
  const s = (name ?? "").trim();
  if (s.length <= 1) return s;
  if (s.length === 2) return s[0] + "*";
  return s[0] + "*".repeat(s.length - 2) + s[s.length - 1];
}

/** 이메일 마스킹 — abcde@x.com → ab***@x.com */
export function maskEmail(email: string): string {
  const [id, domain] = (email ?? "").split("@");
  if (!domain) return email;
  const head = id.length <= 2 ? id : id.slice(0, 2);
  return `${head}${"*".repeat(Math.max(1, id.length - 2))}@${domain}`;
}
