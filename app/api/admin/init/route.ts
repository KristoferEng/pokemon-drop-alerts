import { NextResponse } from "next/server";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import path from "node:path";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * One-shot admin endpoint to apply Drizzle migrations from inside the Render
 * service (where DB IP allowlist allows local-region traffic). Auth: same
 * CRON_SECRET as the cycle endpoint.
 *
 * After this returns ok once, the schema is in place and you can call
 * /api/cron/cycle on a schedule.
 */
export async function POST(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (token !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    return NextResponse.json({ error: "DATABASE_URL not set" }, { status: 500 });
  }

  const pool = new Pool({
    connectionString: url,
    ssl:
      url.includes("sslmode=require") || url.includes("render.com")
        ? { rejectUnauthorized: false }
        : undefined,
  });
  const db = drizzle(pool);
  try {
    await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
    log.info("admin.migrate.ok");
    return NextResponse.json({ ok: true, migrated: true });
  } catch (err) {
    log.error("admin.migrate.failed", { err: String(err) });
    return NextResponse.json({ error: String(err) }, { status: 500 });
  } finally {
    await pool.end();
  }
}

export async function GET(req: Request) {
  return POST(req);
}
