import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_oauth_clients_registration_type" AS ENUM('dynamic', 'metadata_document');
  CREATE TYPE "public"."enum_oauth_clients_token_endpoint_auth_method" AS ENUM('none', 'client_secret_basic', 'client_secret_post');
  CREATE TYPE "public"."enum_oauth_authorization_codes_code_challenge_method" AS ENUM('S256');
  CREATE TYPE "public"."enum_oauth_tokens_type" AS ENUM('access', 'refresh');
  CREATE TABLE "oauth_clients" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"client_id" varchar NOT NULL,
  	"client_name" varchar NOT NULL,
  	"registration_type" "enum_oauth_clients_registration_type" NOT NULL,
  	"token_endpoint_auth_method" "enum_oauth_clients_token_endpoint_auth_method" NOT NULL,
  	"client_secret_hash" varchar,
  	"redirect_uris" jsonb NOT NULL,
  	"client_uri" varchar,
  	"logo_uri" varchar,
  	"metadata" jsonb,
  	"metadata_expires_at" timestamp(3) with time zone,
  	"last_used_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "oauth_authorization_codes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"code_hash" varchar NOT NULL,
  	"client_id" integer NOT NULL,
  	"user_id" integer NOT NULL,
  	"grant_id" integer,
  	"redirect_uri" varchar NOT NULL,
  	"code_challenge" varchar NOT NULL,
  	"code_challenge_method" "enum_oauth_authorization_codes_code_challenge_method" NOT NULL,
  	"resource" varchar NOT NULL,
  	"scope" varchar,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"used_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "oauth_grants" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"client_id" integer NOT NULL,
  	"user_id" integer NOT NULL,
  	"resource" varchar NOT NULL,
  	"scope" varchar,
  	"last_used_at" timestamp(3) with time zone,
  	"revoked_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "oauth_tokens" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"type" "enum_oauth_tokens_type" NOT NULL,
  	"token_hash" varchar NOT NULL,
  	"grant_id" integer NOT NULL,
  	"client_id" integer NOT NULL,
  	"user_id" integer NOT NULL,
  	"resource" varchar NOT NULL,
  	"scope" varchar,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"used_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "oauth_clients_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "oauth_authorization_codes_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "oauth_grants_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "oauth_tokens_id" integer;
  ALTER TABLE "oauth_authorization_codes" ADD CONSTRAINT "oauth_authorization_codes_client_id_oauth_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_clients"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "oauth_authorization_codes" ADD CONSTRAINT "oauth_authorization_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "oauth_authorization_codes" ADD CONSTRAINT "oauth_authorization_codes_grant_id_oauth_grants_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."oauth_grants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "oauth_grants" ADD CONSTRAINT "oauth_grants_client_id_oauth_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_clients"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "oauth_grants" ADD CONSTRAINT "oauth_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "oauth_tokens" ADD CONSTRAINT "oauth_tokens_grant_id_oauth_grants_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."oauth_grants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "oauth_tokens" ADD CONSTRAINT "oauth_tokens_client_id_oauth_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_clients"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "oauth_tokens" ADD CONSTRAINT "oauth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "oauth_clients_client_id_idx" ON "oauth_clients" USING btree ("client_id");
  CREATE INDEX "oauth_clients_updated_at_idx" ON "oauth_clients" USING btree ("updated_at");
  CREATE INDEX "oauth_clients_created_at_idx" ON "oauth_clients" USING btree ("created_at");
  CREATE UNIQUE INDEX "oauth_authorization_codes_code_hash_idx" ON "oauth_authorization_codes" USING btree ("code_hash");
  CREATE INDEX "oauth_authorization_codes_client_idx" ON "oauth_authorization_codes" USING btree ("client_id");
  CREATE INDEX "oauth_authorization_codes_user_idx" ON "oauth_authorization_codes" USING btree ("user_id");
  CREATE INDEX "oauth_authorization_codes_grant_idx" ON "oauth_authorization_codes" USING btree ("grant_id");
  CREATE INDEX "oauth_authorization_codes_expires_at_idx" ON "oauth_authorization_codes" USING btree ("expires_at");
  CREATE INDEX "oauth_authorization_codes_updated_at_idx" ON "oauth_authorization_codes" USING btree ("updated_at");
  CREATE INDEX "oauth_authorization_codes_created_at_idx" ON "oauth_authorization_codes" USING btree ("created_at");
  CREATE INDEX "oauth_grants_client_idx" ON "oauth_grants" USING btree ("client_id");
  CREATE INDEX "oauth_grants_user_idx" ON "oauth_grants" USING btree ("user_id");
  CREATE INDEX "oauth_grants_revoked_at_idx" ON "oauth_grants" USING btree ("revoked_at");
  CREATE INDEX "oauth_grants_updated_at_idx" ON "oauth_grants" USING btree ("updated_at");
  CREATE INDEX "oauth_grants_created_at_idx" ON "oauth_grants" USING btree ("created_at");
  CREATE INDEX "oauth_tokens_type_idx" ON "oauth_tokens" USING btree ("type");
  CREATE UNIQUE INDEX "oauth_tokens_token_hash_idx" ON "oauth_tokens" USING btree ("token_hash");
  CREATE INDEX "oauth_tokens_grant_idx" ON "oauth_tokens" USING btree ("grant_id");
  CREATE INDEX "oauth_tokens_client_idx" ON "oauth_tokens" USING btree ("client_id");
  CREATE INDEX "oauth_tokens_user_idx" ON "oauth_tokens" USING btree ("user_id");
  CREATE INDEX "oauth_tokens_expires_at_idx" ON "oauth_tokens" USING btree ("expires_at");
  CREATE INDEX "oauth_tokens_updated_at_idx" ON "oauth_tokens" USING btree ("updated_at");
  CREATE INDEX "oauth_tokens_created_at_idx" ON "oauth_tokens" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_oauth_clients_fk" FOREIGN KEY ("oauth_clients_id") REFERENCES "public"."oauth_clients"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_oauth_authorization_codes_fk" FOREIGN KEY ("oauth_authorization_codes_id") REFERENCES "public"."oauth_authorization_codes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_oauth_grants_fk" FOREIGN KEY ("oauth_grants_id") REFERENCES "public"."oauth_grants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_oauth_tokens_fk" FOREIGN KEY ("oauth_tokens_id") REFERENCES "public"."oauth_tokens"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_oauth_clients_id_idx" ON "payload_locked_documents_rels" USING btree ("oauth_clients_id");
  CREATE INDEX "payload_locked_documents_rels_oauth_authorization_codes__idx" ON "payload_locked_documents_rels" USING btree ("oauth_authorization_codes_id");
  CREATE INDEX "payload_locked_documents_rels_oauth_grants_id_idx" ON "payload_locked_documents_rels" USING btree ("oauth_grants_id");
  CREATE INDEX "payload_locked_documents_rels_oauth_tokens_id_idx" ON "payload_locked_documents_rels" USING btree ("oauth_tokens_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "oauth_clients" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "oauth_authorization_codes" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "oauth_grants" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "oauth_tokens" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "oauth_clients" CASCADE;
  DROP TABLE "oauth_authorization_codes" CASCADE;
  DROP TABLE "oauth_grants" CASCADE;
  DROP TABLE "oauth_tokens" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_oauth_clients_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_oauth_authorization_codes_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_oauth_grants_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_oauth_tokens_fk";
  
  DROP INDEX "payload_locked_documents_rels_oauth_clients_id_idx";
  DROP INDEX "payload_locked_documents_rels_oauth_authorization_codes__idx";
  DROP INDEX "payload_locked_documents_rels_oauth_grants_id_idx";
  DROP INDEX "payload_locked_documents_rels_oauth_tokens_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "oauth_clients_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "oauth_authorization_codes_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "oauth_grants_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "oauth_tokens_id";
  DROP TYPE "public"."enum_oauth_clients_registration_type";
  DROP TYPE "public"."enum_oauth_clients_token_endpoint_auth_method";
  DROP TYPE "public"."enum_oauth_authorization_codes_code_challenge_method";
  DROP TYPE "public"."enum_oauth_tokens_type";`)
}
