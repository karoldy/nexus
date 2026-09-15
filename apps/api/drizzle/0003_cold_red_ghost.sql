CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" varchar(100) NOT NULL,
	"slug" varchar(120) NOT NULL,
	"description" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "knowledge_tags" (
	"id" uuid PRIMARY KEY NOT NULL,
	"knowledge_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "knowledges" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"category_id" uuid,
	"title" varchar(200) NOT NULL,
	"summary" text,
	"body" text,
	"published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_tags" ADD CONSTRAINT "knowledge_tags_knowledge_id_knowledges_id_fk" FOREIGN KEY ("knowledge_id") REFERENCES "public"."knowledges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_tags" ADD CONSTRAINT "knowledge_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledges" ADD CONSTRAINT "knowledges_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledges" ADD CONSTRAINT "knowledges_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_owner_parent_slug_active_idx" ON "categories" USING btree ("owner_id",coalesce("parent_id", '00000000-0000-0000-0000-000000000000'::uuid),"slug") WHERE "categories"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "categories_owner_id_idx" ON "categories" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_tags_active_idx" ON "knowledge_tags" USING btree ("knowledge_id","tag_id") WHERE "knowledge_tags"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "knowledges_owner_category_idx" ON "knowledges" USING btree ("owner_id","category_id");--> statement-breakpoint
CREATE INDEX "knowledges_owner_published_idx" ON "knowledges" USING btree ("owner_id","published");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_owner_name_active_idx" ON "tags" USING btree ("owner_id","name") WHERE "tags"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "tags_owner_id_idx" ON "tags" USING btree ("owner_id");