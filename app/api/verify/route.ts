import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { parseUSPhone } from "@/lib/phone";
import { isValidEmail } from "@/lib/email";
import { hashOTP, isExpired } from "@/lib/otp";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ATTEMPTS = 5;

const Body = z.object({
  phone: z.string().min(1).max(40).optional(),
  email: z.string().min(3).max(254).optional(),
  code: z.string().regex(/^\d{6}$/, "Invalid code"),
});

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  let identity: { value: string; where: ReturnType<typeof eq> };
  if (parsed.email) {
    const e = parsed.email.trim().toLowerCase();
    if (!isValidEmail(e)) {
      return NextResponse.json({ error: "Please enter a valid email" }, { status: 400 });
    }
    identity = { value: e, where: eq(schema.subscribers.email, e) };
  } else if (parsed.phone) {
    const r = parseUSPhone(parsed.phone);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    identity = { value: r.e164, where: eq(schema.subscribers.phone, r.e164) };
  } else {
    return NextResponse.json({ error: "Email or phone required" }, { status: 400 });
  }

  try {
    const rows = await db.select().from(schema.subscribers).where(identity.where).limit(1);

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
      return NextResponse.json({ error: "Too many attempts. Send a new code." }, { status: 429 });
    }

    const candidate = hashOTP(parsed.code, identity.value);
    if (candidate !== sub.verificationCodeHash) {
      await db
        .update(schema.subscribers)
        .set({ verificationAttempts: (sub.verificationAttempts ?? 0) + 1 })
        .where(identity.where);
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
      .where(identity.where);

    log.info("verification.approved", { id: sub.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error("verify.error", { err: String(err) });
    return NextResponse.json({ error: "Could not verify. Try again." }, { status: 500 });
  }
}
