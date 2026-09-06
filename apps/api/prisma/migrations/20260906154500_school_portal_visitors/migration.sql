-- Tura Public School admission portal visitor / live-online counters.

CREATE TABLE IF NOT EXISTS "platform"."school_portal_visitors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "visitor_key" TEXT NOT NULL,
    "first_seen_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "school_portal_visitors_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_portal_visitors_tenant_id_visitor_key_key"
    ON "platform"."school_portal_visitors"("tenant_id", "visitor_key");

CREATE INDEX IF NOT EXISTS "school_portal_visitors_tenant_id_idx"
    ON "platform"."school_portal_visitors"("tenant_id");

CREATE TABLE IF NOT EXISTS "platform"."school_portal_presence" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "session_key" TEXT NOT NULL,
    "last_seen_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "school_portal_presence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_portal_presence_tenant_id_session_key_key"
    ON "platform"."school_portal_presence"("tenant_id", "session_key");

CREATE INDEX IF NOT EXISTS "school_portal_presence_tenant_id_last_seen_at_idx"
    ON "platform"."school_portal_presence"("tenant_id", "last_seen_at");
