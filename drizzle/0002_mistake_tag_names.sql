DELETE FROM "mistake_tags" a USING "mistake_tags" b WHERE a.id > b.id AND lower(a.name) = lower(b.name);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mistake_tags_name_lower_idx" ON "mistake_tags" (lower("name"));
