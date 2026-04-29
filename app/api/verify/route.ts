import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { parseUSPhone } from "@/lib/phone";
import { hashOTP, isExpired } from "@/lib/otp";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ATTEMPTS = 5;

const Body = z.object({
  phone: z.string().min(1).max(40),
  code: z.string().regex(/^\d{6}$/, "Invalid code"),
});

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const phoneResult = parseUSPhone(parsed.phone);
  if (!phoneResult.ok) {
    return NextResponse.json({ error: phoneResult.error }, { status: 400 });
  }
  const e164 = phoneResult.e164;

  try {
    const rows = await db
      .select()
      .from(schema.subscribers)
      .where(eq(schema.subscribers.phone, e164))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ error: "No code on file. Send a new one." }, { status: 400 });
    }
    const sub = rows[0];

    if (!sub.verificationCodeHash) {
      return NextResponse.json({ error: "No code on file. Send a new one." }, { status: 400 });
    }
    if (isExpired(sub.verificationExpiresAt)) {
      return NextResponse.json({ error: "Code expired. Send a new one." }, { status: 400 });
    }
    if ((sub.verificationAttempts ?? 0) >= MAX_ATTEMPTS) {
      return NextResponse.json(
        { error: "Too many attempts. Send a new code." },
        { status: 429 },
      );
    }

    const candidate = hashOTP(parsed.code, e164);
    if (candidate !== sub.verificationCodeHash) {
      await db
        .update(schema.subscribers)
        .set({ verificationAttempts: (sub.verificationAttempts ?? 0) + 1 })
        .where(eq(schema.subscribers.phone, e164));
      return NextResponse.json({ error: "That code didn't work. Try again." }, { status: 400 });
    }

    await db
      .update(schema.subscribers)
      .set({
        verified: true,
        optedInAt: new Date(),
        unsubscribedAt: null,
        verificationCodeHash: null,
        verificationExpiresAt: null,
        verificationAttempts: 0,
      })
      .where(eq(schema.subscribers.phone, e164));

    log.info("verification.approved", { phone: e164.slice(0, 5) + "…" });
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error("verify.error", { err: String(err) });
    return NextResponse.json({ error: "Could not verify. Try again." }, { status: 500 });
  }
}
