ALTER TABLE "pr_intent" ADD COLUMN "model" text;--> statement-breakpoint
ALTER TABLE "pr_intent" ADD COLUMN "head_sha" text;--> statement-breakpoint
ALTER TABLE "pr_intent" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "pr_intent" ADD COLUMN "sources" jsonb;