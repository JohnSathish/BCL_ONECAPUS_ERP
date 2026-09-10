-- St. Luke's public website visitor presence and analytics (hashed IDs only).

CREATE TABLE IF NOT EXISTS "school"."school_web_visitor_presence" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "visitor_hash" TEXT NOT NULL,
  "first_seen_at" TIMESTAMP(3) NOT NULL,
  "last_seen_at" TIMESTAMP(3) NOT NULL,
  "last_path" TEXT,
  "visit_count" INTEGER NOT NULL DEFAULT 1,
  "page_views" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "school_web_visitor_presence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_web_visitor_presence_tenant_id_visitor_hash_key"
  ON "school"."school_web_visitor_presence"("tenant_id", "visitor_hash");
CREATE INDEX IF NOT EXISTS "school_web_visitor_presence_tenant_id_last_seen_at_idx"
  ON "school"."school_web_visitor_presence"("tenant_id", "last_seen_at");
CREATE INDEX IF NOT EXISTS "school_web_visitor_presence_visitor_hash_idx"
  ON "school"."school_web_visitor_presence"("visitor_hash");

CREATE TABLE IF NOT EXISTS "school"."school_web_visitor_daily" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "day" DATE NOT NULL,
  "visits" INTEGER NOT NULL DEFAULT 0,
  "unique_visitors" INTEGER NOT NULL DEFAULT 0,
  "page_views" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "school_web_visitor_daily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_web_visitor_daily_tenant_id_day_key"
  ON "school"."school_web_visitor_daily"("tenant_id", "day");
CREATE INDEX IF NOT EXISTS "school_web_visitor_daily_tenant_id_day_idx"
  ON "school"."school_web_visitor_daily"("tenant_id", "day");

CREATE TABLE IF NOT EXISTS "school"."school_web_visitor_page_stats" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "day" DATE NOT NULL,
  "path" TEXT NOT NULL,
  "views" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "school_web_visitor_page_stats_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_web_visitor_page_stats_tenant_id_day_path_key"
  ON "school"."school_web_visitor_page_stats"("tenant_id", "day", "path");
CREATE INDEX IF NOT EXISTS "school_web_visitor_page_stats_tenant_id_day_idx"
  ON "school"."school_web_visitor_page_stats"("tenant_id", "day");
