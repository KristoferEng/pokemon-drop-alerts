DROP INDEX "subscribers_phone_unique";--> statement-breakpoint
ALTER TABLE "subscribers" ALTER COLUMN "phone" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "subscribers" ADD COLUMN "email" text;--> statement-breakpoint
CREATE UNIQUE INDEX "subscribers_email_unique" ON "subscribers" USING btree ("email") WHERE "subscribers"."email" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "subscribers_phone_unique" ON "subscribers" USING btree ("phone") WHERE "subscribers"."phone" IS NOT NULL;