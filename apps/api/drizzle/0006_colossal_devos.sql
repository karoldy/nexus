CREATE TABLE "exam_answers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"record_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"type_snapshot" varchar(30) NOT NULL,
	"stem_snapshot" text NOT NULL,
	"options_snapshot" jsonb,
	"answer_snapshot" jsonb NOT NULL,
	"submitted_answer" jsonb,
	"is_correct" boolean,
	"max_score" numeric(8, 2) NOT NULL,
	"score" numeric(8, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "exam_questions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"exam_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"score" numeric(8, 2) DEFAULT '1' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "exam_records" (
	"id" uuid PRIMARY KEY NOT NULL,
	"exam_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"progress" varchar(20) NOT NULL,
	"status" boolean DEFAULT true NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"submitted_at" timestamp with time zone,
	"total_score" numeric(8, 2),
	"earned_score" numeric(8, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "exams" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"duration_seconds" integer,
	"published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "exam_answers" ADD CONSTRAINT "exam_answers_record_id_exam_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."exam_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_answers" ADD CONSTRAINT "exam_answers_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_records" ADD CONSTRAINT "exam_records_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_records" ADD CONSTRAINT "exam_records_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "exam_answers_active_idx" ON "exam_answers" USING btree ("record_id","question_id") WHERE "exam_answers"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "exam_questions_active_idx" ON "exam_questions" USING btree ("exam_id","question_id") WHERE "exam_questions"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "exam_records_in_progress_idx" ON "exam_records" USING btree ("exam_id","user_id") WHERE "exam_records"."deleted_at" is null and "exam_records"."progress" = 'IN_PROGRESS';--> statement-breakpoint
CREATE INDEX "exam_records_exam_user_idx" ON "exam_records" USING btree ("exam_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "exams_owner_title_active_idx" ON "exams" USING btree ("owner_id","title") WHERE "exams"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "exams_owner_id_idx" ON "exams" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "exams_owner_published_idx" ON "exams" USING btree ("owner_id","published");