/**
 * 웹 푸시 발송 — web-push + 저장된 구독(PushSubscription).
 * 비밀키(VAPID_PRIVATE_KEY)가 env에 없으면 조용히 패스(앱은 정상).
 * 죽은 구독(404/410)은 자동 삭제.
 */
import webpush from "web-push";
import { prisma } from "@/lib/db";
import { VAPID_PUBLIC_KEY } from "@/lib/vapid";

const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
let configured = false;

function ensure(): boolean {
  if (!VAPID_PRIVATE_KEY) return false;
  if (!configured) {
    webpush.setVapidDetails("mailto:a43424685@gmail.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    configured = true;
  }
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

export async function sendWebPush(userId: string, payload: PushPayload): Promise<void> {
  if (!ensure()) return; // 비밀키 미설정 → 발송 생략
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return;
  const data = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          data
        );
      } catch (e: unknown) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        }
      }
    })
  );
}
