ALTER TABLE "eval_runs" ADD COLUMN "agent_version" integer;--> statement-breakpoint
CREATE INDEX "eval_runs_case_id_idx" ON "eval_runs" USING btree ("case_id");