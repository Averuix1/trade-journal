ALTER TABLE "accounts" ADD COLUMN "risk_presets" jsonb DEFAULT '[200,250,300,400,500]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "planned_risk" double precision;--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "time_known" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "trades" ALTER COLUMN "contracts" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "instruments" ALTER COLUMN "point_value" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "instruments" ADD COLUMN "aliases" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "session_defs" ADD COLUMN "aliases" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "day_journals" ADD COLUMN "rules_followed" boolean;--> statement-breakpoint
ALTER TABLE "day_journals" ADD COLUMN "rule_break_reason" text;--> statement-breakpoint
ALTER TABLE "day_journals" ADD COLUMN "slept_well" boolean;--> statement-breakpoint
ALTER TABLE "day_journals" ADD COLUMN "screenshot_links" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "day_journals" ADD COLUMN "checklist" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "r_rounding" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "checklist_items" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "checklist_skip_if_no" integer DEFAULT 2 NOT NULL;
