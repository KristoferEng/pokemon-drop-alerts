import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { parseUSPhone } from "@/lib/phone";
import { checkVerification } from "@/lib/twilio";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const check = await checkVerification(e164, parsed.code);
    if (check.status !== "approved") {
      return NextResponse.json(
        { error: "That code didn't work. Try again or request a new one." },
        { status: 400 },
      );
    }

    await db
      .update(schema.subscribers)
      .set({
        verified: true,
        optedInAt: new Date(),
        unsubscribedAt: null,
      })
      .where(eq(schema.subscribers.phone, e164));

    log.info("verification.approved", { phone: e164.slice(0, 5) + "…" });
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error("verify.error", { err: String(err) });
    return NextResponse.json(
      { error: "Could not verify. Try again." },
      { status: 500 },
    );
  }
}
