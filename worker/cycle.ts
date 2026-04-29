import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "../lib/db/client";
import { classifyProduct } from "../lib/classifier";
import { sendSMS } from "../lib/sms";
import { sendEmail } from "../lib/email";
import { log } from "../lib/log";
import { SCRAPERS } from "./retailers";
import { RETAILER_DOMAIN, type RetailerId, type ScrapedProduct } from "./types";

const COOLDOWN_HOURS = Number(process.env.ALERT_COOLDOWN_HOURS ?? 6);
const DRY_RUN = process.env.DRY_RUN === "true";
const TEST_PHONES = (process.env.TEST_PHONES ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

type AlertEvent = {
  productId: number;
  retailer: RetailerId;
  productName: string;
  reason: "new_release" | "restock";
};

function alertText(retailer: RetailerId): string {
  return `Pokemon drop at ${RETAILER_DOMAIN[retailer]} - good luck!`;
}

function alertEmailBody(retailer: RetailerId, events: AlertEvent[]): string {
  const products = events.map((e) => `• ${e.productName}`).join("\n");
  return `A Pokémon TCG card product just dropped at ${RETAILER_DOMAIN[retailer]}:\n\n${products}\n\nGood luck out there.\n\n— Pokémon Drop Alerts`;
}

async function processRetailer(scraperId: RetailerId, scraped: ScrapedProduct[]): Promise<AlertEvent[]> {
  const events: AlertEvent[] = [];
  const cooldownAgo = new Date(Date.now() - COOLDOWN_HOURS * 3600 * 1000);

  for (const sp of scraped) {
    const cls = classifyProduct(sp.productName, sp.category);
    if (!cls.isCardProduct) continue;

    // Upsert the product row
    const inserted = await db
      .insert(schema.products)
      .values({
        retailer: sp.retailer,
        productUrl: sp.productUrl,
        productName: sp.productName,
        isCardProduct: true,
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.products.productUrl,
        set: {
          productName: sp.productName,
          isCardProduct: true,
          lastSeenAt: new Date(),
        },
      })
      .returning({
        id: schema.products.id,
        firstSeenAt: schema.products.firstSeenAt,
      });

    const product = inserted[0];
    const isNew = product.firstSeenAt.getTime() > Date.now() - 60_000;

    // Upsert stock state
    const prior = await db
      .select()
      .from(schema.stockState)
      .where(eq(schema.stockState.productId, product.id))
      .limit(1);

    const wasInStock = prior[0]?.inStock ?? false;
    const lastAlertedAt = prior[0]?.lastAlertedAt ?? null;
    const onCooldown = lastAlertedAt && lastAlertedAt > cooldownAgo;

    await db
      .insert(schema.stockState)
      .values({
        productId: product.id,
        inStock: sp.inStock,
        lastCheckedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.stockState.productId,
        set: {
          inStock: sp.inStock,
          lastCheckedAt: new Date(),
        },
      });

    let reason: AlertEvent["reason"] | null = null;
    if (isNew && sp.inStock) {
      reason = "new_release";
    } else if (!wasInStock && sp.inStock) {
      reason = "restock";
    }

    if (reason && !onCooldown) {
      events.push({
        productId: product.id,
        retailer: sp.retailer,
        productName: sp.productName,
        reason,
      });
      await db
        .update(schema.stockState)
        .set({
          lastAlertedAt: new Date(),
          lastAlertReason: reason,
        })
        .where(eq(schema.stockState.productId, product.id));
    }
  }

  return events;
}

async function dispatchAlerts(events: AlertEvent[]) {
  if (events.length === 0) return { texts: 0, recipients: 0 };

  // Group by retailer so each subscriber gets one text per retailer per cycle
  // (avoids spamming someone if 5 different SKUs at the same retailer drop together)
  const byRetailer = new Map<RetailerId, AlertEvent[]>();
  for (const ev of events) {
    const arr = byRetailer.get(ev.retailer) ?? [];
    arr.push(ev);
    byRetailer.set(ev.retailer, arr);
  }

  // Get verified, opted-in subscribers
  let recipients = await db
    .select()
    .from(schema.subscribers)
    .where(
      and(
        eq(schema.subscribers.verified, true),
        isNull(schema.subscribers.unsubscribedAt),
      ),
    );

  if (TEST_PHONES.length > 0) {
    recipients = recipients.filter((r) => r.phone !== null && TEST_PHONES.includes(r.phone));
    log.info("worker.test_phones_filter", { count: recipients.length });
  }

  let texts = 0;
  for (const [retailer, retailerEvents] of byRetailer) {
    const body = alertText(retailer);
    log.info("alert.batch", {
      retailer,
      productCount: retailerEvents.length,
      recipientCount: recipients.length,
      reasons: retailerEvents.map((e) => e.reason),
    });

    for (const sub of recipients) {
      if (DRY_RUN) {
        log.info("alert.dry_run", { id: sub.id, body });
        continue;
      }
      try {
        let messageId: string | undefined;
        if (sub.email) {
          const sent = await sendEmail(
            sub.email,
            `Pokémon drop at ${RETAILER_DOMAIN[retailer]}`,
            alertEmailBody(retailer, retailerEvents),
          );
          if (!sent.ok) {
            log.warn("alert.send_failed", {
              kind: "email",
              id: sub.id,
              provider: sent.provider,
              error: sent.error,
            });
            continue;
          }
          messageId = sent.messageId;
        } else if (sub.phone) {
          const sent = await sendSMS(sub.phone, body);
          if (!sent.ok) {
            log.warn("alert.send_failed", {
              kind: "sms",
              id: sub.id,
              provider: sent.provider,
              error: sent.error,
            });
            continue;
          }
          messageId = sent.messageId;
        } else {
          continue;
        }
        await db.insert(schema.alertsSent).values({
          subscriberId: sub.id,
          productId: retailerEvents[0].productId,
          reason: retailerEvents[0].reason,
          twilioMessageSid: messageId,
        });
        texts++;
      } catch (err) {
        log.error("alert.send_failed", { id: sub.id, err: String(err) });
      }
    }
  }

  return { texts, recipients: recipients.length };
}

export async function runCycle() {
  const cycleStart = Date.now();
  const allEvents: AlertEvent[] = [];

  const results = await Promise.allSettled(
    SCRAPERS.map(async (s) => {
      const t0 = Date.now();
      try {
        const products = await s.scrape();
        const events = await processRetailer(s.id, products);
        log.info("scrape.ok", {
          retailer: s.id,
          products: products.length,
          alerts: events.length,
          ms: Date.now() - t0,
        });
        return events;
      } catch (err) {
        log.error("scrape.failed", {
          retailer: s.id,
          err: String(err),
          ms: Date.now() - t0,
        });
        return [];
      }
    }),
  );

  for (const r of results) {
    if (r.status === "fulfilled") allEvents.push(...r.value);
  }

  const dispatch = await dispatchAlerts(allEvents);

  log.info("cycle.done", {
    ms: Date.now() - cycleStart,
    alertEvents: allEvents.length,
    texts: dispatch.texts,
    recipients: dispatch.recipients,
  });
}
