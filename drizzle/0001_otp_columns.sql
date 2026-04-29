ALTER TABLE "subscribers" ADD COLUMN "verification_code_hash" text;--> statement-breakpoint
ALTER TABLE "subscribers" ADD COLUMN "verification_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscribers" ADD COLUMN "verification_attempts" integer DEFAULT 0 NOT NULL;