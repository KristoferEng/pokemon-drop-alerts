/**
 * Provider-agnostic SMS sender.
 *
 * Picks a provider based on env, in this priority order:
 *   1. DEV_MODE=true       → log only, never send (returns ok). Best for UI testing.
 *   2. TEXTBELT_KEY set    → TextBelt. Free tier with key `textbelt` = 1 SMS/day per IP.
 *   3. TWILIO_AUTH_TOKEN   → Twilio Messaging Service.
 *   4. otherwise           → throw.
 */
import { log } from "./log";

export type SmsResult = {
  ok: boolean;
  messageId?: string;
  provider: "dev" | "textbelt" | "twilio";
  error?: string;
};

export async function sendSMS(phoneE164: string, body: string): Promise<SmsResult> {
  if (process.env.DEV_MODE === "true") {
    log.info("sms.dev_mode", { to: phoneE164, body });
    return { ok: true, provider: "dev", messageId: "dev-" + Date.now() };
  }

  if (process.env.TEXTBELT_KEY) {
    return sendViaTextBelt(phoneE164, body);
  }

  if (process.env.TWILIO_AUTH_TOKEN) {
    return sendViaTwilio(phoneE164, body);
  }

  throw new Error("No SMS provider configured (set DEV_MODE, TEXTBELT_KEY, or TWILIO_*)");
}

async function sendViaTextBelt(phone: string, message: string): Promise<SmsResult> {
  const key = process.env.TEXTBELT_KEY!;
  const res = await fetch("https://textbelt.com/text", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ phone, message, key }).toString(),
  });
  const data = (await res.json()) as {
    success: boolean;
    textId?: string;
    error?: string;
    quotaRemaining?: number;
  };
  if (!data.success) {
    log.warn("sms.textbelt.failed", { error: data.error, quotaRemaining: data.quotaRemaining });
    return { ok: false, provider: "textbelt", error: data.error ?? "unknown" };
  }
  log.info("sms.textbelt.sent", { textId: data.textId, quotaRemaining: data.quotaRemaining });
  return { ok: true, provider: "textbelt", messageId: data.textId };
}

async function sendViaTwilio(phone: string, message: string): Promise<SmsResult> {
  const { sendAlert } = await import("./twilio");
  try {
    const m = await sendAlert(phone, message);
    return { ok: true, provider: "twilio", messageId: m.sid };
  } catch (err) {
    return { ok: false, provider: "twilio", error: String(err) };
  }
}
