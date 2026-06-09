CREATE TABLE "book_analysis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"workflow_id" uuid NOT NULL,
	"analysis_type" text NOT NULL,
	"chunk_index" integer,
	"result" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "book_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"token_count" integer DEFAULT 0 NOT NULL,
	"embedding" vector(1536),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"author" text,
	"raw_text" text NOT NULL,
	"chunk_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'uploaded' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"chunk_id" uuid NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"analysis_id" uuid NOT NULL,
	"text" text NOT NULL,
	"context" text,
	"category" text NOT NULL,
	"score" real DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "themes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"analysis_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"weight" real DEFAULT 0,
	"evidence" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_library" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"book_id" uuid NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL,
	"last_read_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "workflow_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"current_node" text,
	"current_chunk_index" integer DEFAULT 0,
	"progress" real DEFAULT 0,
	"state_snapshot" jsonb,
	"checkpoint_id" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"errors" jsonb,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"node_name" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"input_data" jsonb,
	"output_data" jsonb,
	"error" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "book_analysis" ADD CONSTRAINT "book_analysis_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_analysis" ADD CONSTRAINT "book_analysis_workflow_id_workflow_runs_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflow_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_chunks" ADD CONSTRAINT "book_chunks_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "embeddings" ADD CONSTRAINT "embeddings_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "embeddings" ADD CONSTRAINT "embeddings_chunk_id_book_chunks_id_fk" FOREIGN KEY ("chunk_id") REFERENCES "public"."book_chunks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_analysis_id_book_analysis_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."book_analysis"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "themes" ADD CONSTRAINT "themes_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "themes" ADD CONSTRAINT "themes_analysis_id_book_analysis_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."book_analysis"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_library" ADD CONSTRAINT "user_library_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_workflow_id_workflow_runs_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflow_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_book_analysis_book_id" ON "book_analysis" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "idx_book_analysis_workflow_id" ON "book_analysis" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "idx_book_analysis_type" ON "book_analysis" USING btree ("analysis_type");--> statement-breakpoint
CREATE INDEX "idx_book_analysis_aggregated" ON "book_analysis" USING btree ("book_id","analysis_type") WHERE chunk_index IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_book_chunks_book_chunk" ON "book_chunks" USING btree ("book_id","chunk_index");--> statement-breakpoint
CREATE INDEX "idx_book_chunks_book_id" ON "book_chunks" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "idx_book_chunks_book_order" ON "book_chunks" USING btree ("book_id","chunk_index");--> statement-breakpoint
CREATE INDEX "idx_embeddings_book_id" ON "embeddings" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "idx_embeddings_chunk_id" ON "embeddings" USING btree ("chunk_id");--> statement-breakpoint
CREATE INDEX "idx_quotes_book_id" ON "quotes" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "idx_quotes_analysis_id" ON "quotes" USING btree ("analysis_id");--> statement-breakpoint
CREATE INDEX "idx_quotes_book_score" ON "quotes" USING btree ("book_id","score");--> statement-breakpoint
CREATE INDEX "idx_quotes_category" ON "quotes" USING btree ("book_id","category");--> statement-breakpoint
CREATE INDEX "idx_themes_book_id" ON "themes" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "idx_themes_analysis_id" ON "themes" USING btree ("analysis_id");--> statement-breakpoint
CREATE INDEX "idx_themes_book_weight" ON "themes" USING btree ("book_id","weight");--> statement-breakpoint
CREATE UNIQUE INDEX "user_book_unique" ON "user_library" USING btree ("user_id","book_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_runs_book_id" ON "workflow_runs" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_runs_user_id" ON "workflow_runs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_runs_status" ON "workflow_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_workflow_runs_active" ON "workflow_runs" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_workflow_steps_workflow_id" ON "workflow_steps" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_steps_wf_order" ON "workflow_steps" USING btree ("workflow_id","created_at");