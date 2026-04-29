import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { parseUSPhone } from "@/lib/phone";
import { sendSMS } from "@/lib/sms";
import { sendEmail, isValidEmail } from "@/lib/email";
import { generateOTP, hashOTP, OTP_TTL_MS } from "@/lib/otp";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  phone: z.string().min(1).max(40).optional(),
  email: z.string().min(3).max(254).optional(),
});

function maskPhone(e164: string) {
  return `(•••) •••-${e164.slice(-4)}`;
}

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const head = local.slice(0, 2);
  return `${head}${"•".repeat(Math.max(local.length - 2, 1))}@${domain}`;
}

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!parsed.phone && !parsed.email) {
    return NextResponse.json({ error: "Email or phone required" }, { status: 400 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  let identity: { kind: "email" | "phone"; value: string; mask: string };
  if (parsed.email) {
    const e = parsed.email.trim().toLowerCase();
    if (!isValidEmail(e)) {
      return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
    }
    identity = { kind: "email", value: e, mask: maskEmail(e) };
  } else {
    const r = parseUSPhone(parsed.phone!);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    identity = { kind: "phone", value: r.e164, mask: maskPhone(r.e164) };
  }

  try {
    const code = generateOTP();
    const codeHash = hashOTP(code, identity.value);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    const where =
      identity.kind === "email"
        ? eq(schema.subscribers.email, identity.value)
        : eq(schema.subscribers.phone, identity.value);

    const existing = await db.select().from(schema.subscribers).where(where).limit(1);

    if (existing.length === 0) {
      await db.insert(schema.subscribers).values({
        ...(identity.kind === "email" ? { email: identity.value } : { phone: identity.value }),
        verified: false,
        optInIp: ip,
        verificationCodeHash: codeHash,
        verificationExpiresAt: expiresAt,
        verificationAttempts: 0,
      });
    } else {
      await db
        .update(schema.subscribers)
        .set({
          verificationCodeHash: codeHash,
          verificationExpiresAt: expiresAt,
          verificationAttempts: 0,
        })
        .where(where);
    }

    let provider: string;
    if (identity.kind === "email") {
      const sent = await sendEmail(
        identity.value,
        "Your Pokémon Drop Alerts code",
        `Your verification code is ${code}. It expires in 10 minutes.\n\n— Pokémon Drop Alerts`,
      );
      if (!sent.ok) {
        log.warn("signup.email_failed", { error: sent.error, provider: sent.provider });
        return NextResponse.json(
          { error: "Could not send verification code. Try again in a moment." },
          { status: 500 },
        );
      }
      provider = sent.provider;
    } else {
      const sent = await sendSMS(
        identity.value,
        `Pokemon Drop Alerts: your verification code is ${code}. Expires in 10 minutes.`,
      );
      if (!sent.ok) {
        log.warn("signup.sms_failed", { error: sent.error, provider: sent.provider });
        return NextResponse.json(
          { error: "Could not send verification code. Try again in a moment." },
          { status: 500 },
        );
      }
      provider = sent.provider;
    }

    log.info("verification.sent", { mask: identity.mask, ip, provider });

    const response: Record<string, unknown> = {
      ok: true,
      maskedTarget: identity.mask,
      channel: identity.kind,
      provider,
    };
    if (process.env.DEV_MODE === "true") response.devCode = code;
    return NextResponse.json(response);
  } catch (err) {
    log.error("signup.error", { err: String(err) });
    return NextResponse.json(
      { error: "Could not send verification code. Try again in a moment." },
      { status: 500 },
    );
  }
}
