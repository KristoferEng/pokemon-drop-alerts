CREATE TABLE "alerts_sent" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscriber_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"reason" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"twilio_message_sid" text
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"retailer" text NOT NULL,
	"product_url" text NOT NULL,
	"product_name" text NOT NULL,
	"is_card_product" boolean DEFAULT false NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_state" (
	"product_id" integer PRIMARY KEY NOT NULL,
	"in_stock" boolean DEFAULT false NOT NULL,
	"last_checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_alerted_at" timestamp with time zone,
	"last_alert_reason" text
);
--> statement-breakpoint
CREATE TABLE "subscribers" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone" text NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"opted_in_at" timestamp with time zone,
	"opt_in_ip" text,
	"unsubscribed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alerts_sent" ADD CONSTRAINT "alerts_sent_subscriber_id_subscribers_id_fk" FOREIGN KEY ("subscriber_id") REFERENCES "public"."subscribers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts_sent" ADD CONSTRAINT "alerts_sent_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_state" ADD CONSTRAINT "stock_state_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alerts_subscriber_idx" ON "alerts_sent" USING btree ("subscriber_id");--> statement-breakpoint
CREATE INDEX "alerts_product_idx" ON "alerts_sent" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_url_unique" ON "products" USING btree ("product_url");--> statement-breakpoint
CREATE INDEX "products_retailer_idx" ON "products" USING btree ("retailer");--> statement-breakpoint
CREATE UNIQUE INDEX "subscribers_phone_unique" ON "subscribers" USING btree ("phone");