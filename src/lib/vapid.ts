// VAPID 공개키 — 브라우저 푸시 구독에 쓰임. 공개돼도 안전한 값이라 기본값 하드코딩.
// (비밀키 VAPID_PRIVATE_KEY 는 서버 env 로만 — 코드에 넣지 않음)
export const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ??
  "BPrlz6lZsXaJfjPvFDf8tAkoKEVbP1GCjH26TY3jb198GeVHjIogdJjFINGDNkt8VMngM2XOu9pnS4qSB7NjzOk";
