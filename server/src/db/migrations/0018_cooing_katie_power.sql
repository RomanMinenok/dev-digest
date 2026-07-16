ALTER TABLE "ci_runs" ADD COLUMN "run_id" uuid;--> statement-breakpoint
ALTER TABLE "ci_runs" ADD COLUMN "pr_title" text;--> statement-breakpoint
ALTER TABLE "ci_runs" ADD COLUMN "critical" integer;--> statement-breakpoint
ALTER TABLE "ci_runs" ADD COLUMN "warning" integer;--> statement-breakpoint
ALTER TABLE "ci_runs" ADD COLUMN "suggestion" integer;--> statement-breakpoint
ALTER TABLE "ci_runs" ADD CONSTRAINT "ci_runs_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ci_runs_run_id_idx" ON "ci_runs" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "ci_runs_ci_installation_id_github_url_idx" ON "ci_runs" USING btree ("ci_installation_id","github_url");