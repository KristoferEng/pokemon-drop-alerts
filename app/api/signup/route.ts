import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { parseUSPhone } from "@/lib/phone";
import { sendVerification } from "@/lib/twilio";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ phone: z.string().min(1).max(40) });

function maskPhone(e164: string) {
  // +14155551234 → (•••) •••-1234
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
      });
    } else if (existing[0].verified && !existing[0].unsubscribedAt) {
      // Already subscribed and verified — re-send code anyway so they can
      // re-confirm if their phone changed hands
    }

    await sendVerification(e164);

    log.info("verification.sent", { phone: e164.slice(0, 5) + "…", ip });
    return NextResponse.json({ ok: true, maskedPhone: maskPhone(e164) });
  } catch (err) {
    log.error("signup.error", { err: String(err) });
    return NextResponse.json(
      { error: "Could not send verification code. Try again in a moment." },
      { status: 500 },
    );
  }
}
