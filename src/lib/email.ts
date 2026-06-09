/**
 * 이메일 발송 (Resend).
 * RESEND_API_KEY 가 없으면 발송하지 않고 콘솔에만 링크를 남긴다(개발/미설정 환경 안전장치).
 */
import { Resend } from "resend";
import { BUSINESS } from "@/lib/businessInfo";

const FROM = process.env.EMAIL_FROM || "먹고핀 <onboarding@resend.dev>";

function client(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export async function sendVerificationEmail(to: string, url: string): Promise<void> {
  const resend = client();
  if (!resend) {
    console.log(`[email] (미발송 — RESEND_API_KEY 없음) 인증 링크: ${url}`);
    return;
  }
  const html = `
    <div style="max-width:480px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo',sans-serif;color:#1f2b25">
      <h1 style="font-size:22px;font-weight:900;color:#1f4d3f">먹고핀 이메일 인증</h1>
      <p style="font-size:15px;line-height:1.6;color:#4b5a52">
        아래 버튼을 눌러 이메일 인증을 완료해 주세요. 인증 후 바로 로그인할 수 있어요.
      </p>
      <a href="${url}" style="display:inline-block;margin:16px 0;padding:13px 22px;background:#1f4d3f;color:#fff;
        font-size:15px;font-weight:800;border-radius:12px;text-decoration:none">이메일 인증하기</a>
      <p style="font-size:12px;color:#9aa49e;line-height:1.6">
        버튼이 안 되면 이 주소를 복사해 열어주세요:<br/>${url}<br/>
        본 메일을 요청하지 않으셨다면 무시하셔도 됩니다.
      </p>
      <hr style="border:none;border-top:1px solid #eee;margin:18px 0"/>
      <p style="font-size:11px;color:#b3b9b5">${BUSINESS.company} · ${BUSINESS.email}</p>
    </div>`;

  await resend.emails.send({
    from: FROM,
    to,
    subject: "[먹고핀] 이메일 인증을 완료해 주세요",
    html,
  });
}
