CREATE TABLE "content_knowledges" (
	"id" uuid PRIMARY KEY NOT NULL,
	"content_id" uuid NOT NULL,
	"knowledge_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "contents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"type" varchar(20) NOT NULL,
	"title" varchar(200) NOT NULL,
	"body" text,
	"summary" text,
	"url" varchar(2000),
	"file_key" varchar(500),
	"mime_type" varchar(100),
	"file_size" bigint,
	"metadata" jsonb,
	"published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "content_knowledges" ADD CONSTRAINT "content_knowledges_content_id_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."contents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_knowledges" ADD CONSTRAINT "content_knowledges_knowledge_id_knowledges_id_fk" FOREIGN KEY ("knowledge_id") REFERENCES "public"."knowledges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contents" ADD CONSTRAINT "contents_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "content_knowledges_active_idx" ON "content_knowledges" USING btree ("content_id","knowledge_id") WHERE "content_knowledges"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "contents_owner_id_idx" ON "contents" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "contents_owner_published_idx" ON "contents" USING btree ("owner_id","published");--> statement-breakpoint
CREATE INDEX "contents_owner_type_idx" ON "contents" USING btree ("owner_id","type");