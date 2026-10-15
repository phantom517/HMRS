CREATE TABLE "holidays" (
	"id" text PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"name" text NOT NULL,
	"name_np" text,
	"category" text DEFAULT 'public' NOT NULL,
	"observed" boolean DEFAULT true NOT NULL,
	"note" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "department_settings" ADD COLUMN "default_calendar_system" text DEFAULT 'AD' NOT NULL;--> statement-breakpoint
ALTER TABLE "department_settings" ADD COLUMN "default_locale" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "department_settings" ADD COLUMN "period_basis" text DEFAULT 'AD_MONTH' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "calendar_system" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ui_locale" text;--> statement-breakpoint
CREATE UNIQUE INDEX "holidays_date_idx" ON "holidays" USING btree ("date");