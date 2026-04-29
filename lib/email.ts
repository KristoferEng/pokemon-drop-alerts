import { log } from "./log";

export type EmailResult = {
  ok: boolean;
  messageId?: string;
  provider: "dev" | "resend" | "smtp";
  error?: string;
};

const FROM = process.env.EMAIL_FROM ?? "Pokemon Drop Alerts <onboarding@resend.dev>";

export function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
}

export async function sendEmail(to: string, subject: string, text: string): Promise<EmailResult> {
  if (process.env.DEV_MODE === "true") {
    log.info("email.dev_mode", { to, subject, text });
    return { ok: true, provider: "dev", messageId: "dev-" + Date.now() };
  }

  if (process.env.RESEND_API_KEY) {
    return sendViaResend(to, subject, text);
  }

  throw new Error("No email provider configured (set DEV_MODE or RESEND_API_KEY)");
}

async function sendViaResend(to: string, subject: string, text: string): Promise<EmailResult> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to, subject, text }),
  });
  const data = (await res.json()) as { id?: string; message?: string; name?: string };
  if (!res.ok) {
    log.warn("email.resend.failed", { status: res.status, message: data.message });
    return { ok: false, provider: "resend", error: data.message ?? `${res.status}` };
  }
  log.info("email.resend.sent", { id: data.id, to });
  return { ok: true, provider: "resend", messageId: data.id };
}
