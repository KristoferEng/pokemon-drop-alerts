import twilio from "twilio";

let client: ReturnType<typeof twilio> | null = null;

export function getTwilio() {
  if (client) return client;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    throw new Error("TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set");
  }
  client = twilio(sid, token);
  return client;
}

export async function sendVerification(phoneE164: string) {
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!serviceSid) throw new Error("TWILIO_VERIFY_SERVICE_SID is not set");
  return getTwilio()
    .verify.v2.services(serviceSid)
    .verifications.create({ to: phoneE164, channel: "sms" });
}

export async function checkVerification(phoneE164: string, code: string) {
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!serviceSid) throw new Error("TWILIO_VERIFY_SERVICE_SID is not set");
  return getTwilio()
    .verify.v2.services(serviceSid)
    .verificationChecks.create({ to: phoneE164, code });
}

export async function sendAlert(phoneE164: string, body: string) {
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  if (!messagingServiceSid) throw new Error("TWILIO_MESSAGING_SERVICE_SID is not set");
  return getTwilio().messages.create({
    to: phoneE164,
    messagingServiceSid,
    body,
  });
}
