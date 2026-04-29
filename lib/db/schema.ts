import {
  pgTable,
  serial,
  text,
  boolean,
  timestamp,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const subscribers = pgTable(
  "subscribers",
  {
    id: serial("id").primaryKey(),
    phone: text("phone"),
    email: text("email"),
    verified: boolean("verified").notNull().default(false),
    optedInAt: timestamp("opted_in_at", { withTimezone: true }),
    optInIp: text("opt_in_ip"),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
    verificationCodeHash: text("verification_code_hash"),
    verificationExpiresAt: timestamp("verification_expires_at", { withTimezone: true }),
    verificationAttempts: integer("verification_attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    phoneUnique: uniqueIndex("subscribers_phone_unique")
      .on(t.phone)
      .where(sql`${t.phone} IS NOT NULL`),
    emailUnique: uniqueIndex("subscribers_email_unique")
      .on(t.email)
      .where(sql`${t.email} IS NOT NULL`),
  }),
);

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    retailer: text("retailer").notNull(),
    productUrl: text("product_url").notNull(),
    productName: text("product_name").notNull(),
    isCardProduct: boolean("is_card_product").notNull().default(false),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    urlUnique: uniqueIndex("products_url_unique").on(t.productUrl),
    retailerIdx: index("products_retailer_idx").on(t.retailer),
  }),
);

export const stockState = pgTable("stock_state", {
  productId: integer("product_id")
    .primaryKey()
    .references(() => products.id, { onDelete: "cascade" }),
  inStock: boolean("in_stock").notNull().default(false),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }).notNull().defaultNow(),
  lastAlertedAt: timestamp("last_alerted_at", { withTimezone: true }),
  lastAlertReason: text("last_alert_reason"), // 'restock' | 'new_release'
});

export const alertsSent = pgTable(
  "alerts_sent",
  {
    id: serial("id").primaryKey(),
    subscriberId: integer("subscriber_id")
      .notNull()
      .references(() => subscribers.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(), // 'restock' | 'new_release'
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
    twilioMessageSid: text("twilio_message_sid"),
  },
  (t) => ({
    subscriberIdx: index("alerts_subscriber_idx").on(t.subscriberId),
    productIdx: index("alerts_product_idx").on(t.productId),
  }),
);

export type Subscriber = typeof subscribers.$inferSelect;
export type NewSubscriber = typeof subscribers.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type StockState = typeof stockState.$inferSelect;
