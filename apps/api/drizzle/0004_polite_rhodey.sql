CREATE TABLE "collection_questions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"collection_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "question_knowledges" (
	"id" uuid PRIMARY KEY NOT NULL,
	"question_id" uuid NOT NULL,
	"knowledge_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"type" varchar(30) NOT NULL,
	"stem" text NOT NULL,
	"options" jsonb,
	"answer" jsonb NOT NULL,
	"explanation" text,
	"difficulty" integer DEFAULT 3 NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "collection_questions" ADD CONSTRAINT "collection_questions_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_questions" ADD CONSTRAINT "collection_questions_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_knowledges" ADD CONSTRAINT "question_knowledges_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_knowledges" ADD CONSTRAINT "question_knowledges_knowledge_id_knowledges_id_fk" FOREIGN KEY ("knowledge_id") REFERENCES "public"."knowledges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "collection_questions_active_idx" ON "collection_questions" USING btree ("collection_id","question_id") WHERE "collection_questions"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "collections_owner_name_active_idx" ON "collections" USING btree ("owner_id","name") WHERE "collections"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "collections_owner_id_idx" ON "collections" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "question_knowledges_active_idx" ON "question_knowledges" USING btree ("question_id","knowledge_id") WHERE "question_knowledges"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "questions_owner_id_idx" ON "questions" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "questions_owner_published_idx" ON "questions" USING btree ("owner_id","published");--> statement-breakpoint
CREATE INDEX "questions_owner_type_idx" ON "questions" USING btree ("owner_id","type");