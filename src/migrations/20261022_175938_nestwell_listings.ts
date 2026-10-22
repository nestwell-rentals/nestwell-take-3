import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_listings_status" AS ENUM('pending', 'approved', 'rejected', 'rented');
  CREATE TABLE "listings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"status" "enum_listings_status" DEFAULT 'pending' NOT NULL,
  	"monthly_rent" numeric NOT NULL,
  	"deposit" numeric NOT NULL,
  	"available_from" timestamp(3) with time zone NOT NULL,
  	"street_address" varchar NOT NULL,
  	"city" varchar NOT NULL,
  	"size" numeric NOT NULL,
  	"rooms" numeric NOT NULL,
  	"furnished" boolean DEFAULT false,
  	"pets_allowed" boolean DEFAULT false,
  	"description" jsonb NOT NULL,
  	"landlord_name" varchar NOT NULL,
  	"landlord_email" varchar NOT NULL,
  	"landlord_phone" varchar NOT NULL,
  	"internal_notes" varchar,
  	"website" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "listings_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer,
  	"users_id" integer
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "listings_id" integer;
  ALTER TABLE "listings_rels" ADD CONSTRAINT "listings_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "listings_rels" ADD CONSTRAINT "listings_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "listings_rels" ADD CONSTRAINT "listings_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "listings_slug_idx" ON "listings" USING btree ("slug");
  CREATE INDEX "listings_status_idx" ON "listings" USING btree ("status");
  CREATE INDEX "listings_city_idx" ON "listings" USING btree ("city");
  CREATE INDEX "listings_updated_at_idx" ON "listings" USING btree ("updated_at");
  CREATE INDEX "listings_created_at_idx" ON "listings" USING btree ("created_at");
  CREATE INDEX "listings_rels_order_idx" ON "listings_rels" USING btree ("order");
  CREATE INDEX "listings_rels_parent_idx" ON "listings_rels" USING btree ("parent_id");
  CREATE INDEX "listings_rels_path_idx" ON "listings_rels" USING btree ("path");
  CREATE INDEX "listings_rels_media_id_idx" ON "listings_rels" USING btree ("media_id");
  CREATE INDEX "listings_rels_users_id_idx" ON "listings_rels" USING btree ("users_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_listings_fk" FOREIGN KEY ("listings_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_listings_id_idx" ON "payload_locked_documents_rels" USING btree ("listings_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_listings_fk";
  ALTER TABLE "listings" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "listings_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "listings" CASCADE;
  DROP TABLE "listings_rels" CASCADE;
  
  DROP INDEX "payload_locked_documents_rels_listings_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "listings_id";
  DROP TYPE "public"."enum_listings_status";`)
}
