ALTER TABLE "skills" ALTER COLUMN "context_docs" SET DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "agents" ALTER COLUMN "context_docs" SET DEFAULT '[]'::jsonb;