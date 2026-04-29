import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { parseUSPhone } from "@/lib/phone";
import { sendSMS } from "@/lib/sms";
import { generateOTP, hashOTP, OTP_TTL_MS } from "@/lib/otp";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ phone: z.string().min(1).max(40) });

function maskPhone(e164: string) {
  const last4 = e164.slice(-4);
  return `(•••) •••-${last4}`;
}

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const result = parseUSPhone(parsed.phone);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  const e164 = result.e164;

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  try {
    const code = generateOTP();
    const codeHash = hashOTP(code, e164);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    const existing = await db
      .select()
      .from(schema.subscribers)
      .where(eq(schema.subscribers.phone, e164))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(schema.subscribers).values({
        phone: e164,
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
        .where(eq(schema.subscribers.phone, e164));
    }

    const sent = await sendSMS(e164, `Pokemon Drop Alerts: your verification code is ${code}. Expires in 10 minutes.`);
    if (!sent.ok) {
      log.warn("signup.sms_failed", { error: sent.error, provider: sent.provider });
      return NextResponse.json(
        { error: "Could not send verification code. Try again in a moment." },
        { status: 500 },
      );
    }

    log.info("verification.sent", { phone: e164.slice(0, 5) + "…", ip, provider: sent.provider });

    const response: Record<string, unknown> = {
      ok: true,
      maskedPhone: maskPhone(e164),
      provider: sent.provider,
    };
    // In dev mode, return the code so testing doesn't require an actual SMS
    if (process.env.DEV_MODE === "true") {
      response.devCode = code;
    }
    return NextResponse.json(response);
  } catch (err) {
    log.error("signup.error", { err: String(err) });
    return NextResponse.json(
      { error: "Could not send verification code. Try again in a moment." },
      { status: 500 },
    );
  }
}
