ALTER TABLE "reservations" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "reservations" ALTER COLUMN "status" SET DEFAULT 'pending'::text;--> statement-breakpoint
UPDATE "reservations" SET "status" = 'pending' WHERE "status" = 'new';--> statement-breakpoint
DROP TYPE "public"."reservation_status";--> statement-breakpoint
CREATE TYPE "public"."reservation_status" AS ENUM('pending', 'confirmed', 'rejected', 'cancelled');--> statement-breakpoint
ALTER TABLE "reservations" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."reservation_status";--> statement-breakpoint
ALTER TABLE "reservations" ALTER COLUMN "status" SET DATA TYPE "public"."reservation_status" USING "status"::"public"."reservation_status";--> statement-breakpoint
ALTER TABLE "contact_messages" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "contact_messages" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "contact_messages" ADD COLUMN "ip_hash" text;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "duration_minutes" integer DEFAULT 120 NOT NULL;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "start_minute" integer GENERATED ALWAYS AS ((split_part(reservation_time, ':', 1)::int * 60 + split_part(reservation_time, ':', 2)::int)) STORED;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "ip_hash" text;--> statement-breakpoint
ALTER TABLE "restaurant_settings" ADD COLUMN "schedule" jsonb DEFAULT '[{"open":"12:00","close":"23:00"},{"open":"12:00","close":"23:00"},{"open":"12:00","close":"23:00"},{"open":"12:00","close":"23:00"},{"open":"12:00","close":"01:00"},{"open":"12:00","close":"01:00"},{"open":"12:00","close":"22:00"}]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "restaurant_settings" ADD COLUMN "reservation_duration_minutes" integer DEFAULT 120 NOT NULL;--> statement-breakpoint
ALTER TABLE "restaurant_settings" ADD COLUMN "slot_interval_minutes" integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE "restaurant_settings" ADD COLUMN "seating_capacity" integer DEFAULT 40 NOT NULL;--> statement-breakpoint
ALTER TABLE "restaurant_settings" ADD COLUMN "max_concurrent_reservations" integer DEFAULT 12 NOT NULL;--> statement-breakpoint
ALTER TABLE "restaurant_settings" ADD COLUMN "max_party_size" integer DEFAULT 12 NOT NULL;--> statement-breakpoint
ALTER TABLE "restaurant_settings" ADD COLUMN "min_notice_minutes" integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE "restaurant_settings" ADD COLUMN "booking_horizon_days" integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE "restaurant_settings" ADD COLUMN "auto_confirm" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "contact_messages_ip_idx" ON "contact_messages" USING btree ("ip_hash","created_at");--> statement-breakpoint
CREATE INDEX "reservations_date_status_idx" ON "reservations" USING btree ("reservation_date","status");--> statement-breakpoint
CREATE INDEX "reservations_ip_idx" ON "reservations" USING btree ("ip_hash","created_at");--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_idempotency_key_unique" UNIQUE("idempotency_key");--> statement-breakpoint
ALTER TABLE "contact_messages" ADD CONSTRAINT "contact_messages_has_contact" CHECK ("contact_messages"."email" is not null or "contact_messages"."phone" is not null);