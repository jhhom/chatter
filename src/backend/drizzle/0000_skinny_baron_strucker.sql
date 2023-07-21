-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migraitons
/*
CREATE TABLE IF NOT EXISTS "knex_migrations_lock" (
	"index" serial NOT NULL,
	"is_locked" integer
);

CREATE TABLE IF NOT EXISTS "knex_migrations" (
	"id" serial NOT NULL,
	"name" varchar(255),
	"batch" integer,
	"migration_time" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "users" (
	"id" serial NOT NULL,
	"username" varchar(255) DEFAULT ''::character varying NOT NULL,
	"fullname" varchar(255) DEFAULT ''::character varying NOT NULL,
	"email" varchar(255) DEFAULT ''::character varying NOT NULL,
	"password" varchar(255) DEFAULT ''::character varying NOT NULL,
	"password_hash" text DEFAULT '' NOT NULL,
	"user_agent" varchar(255) DEFAULT ''::character varying NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "messages" (
	"id" serial NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"sequence_id" serial NOT NULL,
	"topic_id" integer NOT NULL,
	"author" varchar(255) NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "topics" (
	"id" serial NOT NULL,
	"user_1" integer NOT NULL,
	"user_2" integer NOT NULL,
	"touched_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_author_fkey" FOREIGN KEY ("author") REFERENCES "users"("username") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "topics" ADD CONSTRAINT "topics_user_1_fkey" FOREIGN KEY ("user_1") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "topics" ADD CONSTRAINT "topics_user_2_fkey" FOREIGN KEY ("user_2") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users" ("email");
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_key" ON "users" ("username");
CREATE UNIQUE INDEX IF NOT EXISTS "topics_user_1_user_2_key" ON "topics" ("user_1","user_2");
*/