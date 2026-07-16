ALTER TABLE "eval_runs" ADD COLUMN "matched" integer;--> statement-breakpoint
ALTER TABLE "eval_runs" ADD COLUMN "expected_total" integer;--> statement-breakpoint
ALTER TABLE "eval_runs" ADD COLUMN "produced" integer;--> statement-breakpoint
ALTER TABLE "eval_runs" ADD COLUMN "false_positives" integer;--> statement-breakpoint
ALTER TABLE "eval_runs" ADD COLUMN "kept" integer;--> statement-breakpoint
ALTER TABLE "eval_runs" ADD COLUMN "dropped" integer;