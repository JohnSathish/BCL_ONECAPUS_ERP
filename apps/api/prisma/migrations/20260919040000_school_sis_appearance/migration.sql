-- School SIS appearance studio (white-label branding). Isolated school schema.

CREATE TABLE IF NOT EXISTS "school"."school_appearance_settings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'royal',
    "mode" TEXT NOT NULL DEFAULT 'system',
    "primary_color" TEXT NOT NULL DEFAULT '#1A365D',
    "secondary_color" TEXT NOT NULL DEFAULT '#2B4C7E',
    "accent_color" TEXT NOT NULL DEFAULT '#0EA5E9',
    "success_color" TEXT NOT NULL DEFAULT '#16A34A',
    "warning_color" TEXT NOT NULL DEFAULT '#D97706',
    "danger_color" TEXT NOT NULL DEFAULT '#DC2626',
    "font_family" TEXT NOT NULL DEFAULT 'Inter',
    "logo_url" TEXT,
    "dark_logo_url" TEXT,
    "mobile_logo_url" TEXT,
    "favicon_url" TEXT,
    "sidebar_style" TEXT NOT NULL DEFAULT 'classic',
    "sidebar_width" INTEGER NOT NULL DEFAULT 260,
    "sidebar_position" TEXT NOT NULL DEFAULT 'left',
    "border_radius" INTEGER NOT NULL DEFAULT 16,
    "card_style" TEXT NOT NULL DEFAULT 'elevated',
    "button_style" TEXT NOT NULL DEFAULT 'solid',
    "login_layout" TEXT NOT NULL DEFAULT 'split',
    "login_background" TEXT NOT NULL DEFAULT 'gradient',
    "login_overlay" INTEGER NOT NULL DEFAULT 40,
    "custom_css" TEXT NOT NULL DEFAULT '',
    "config_json" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" UUID,
    CONSTRAINT "school_appearance_settings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "school_appearance_settings_tenant_id_key"
  ON "school"."school_appearance_settings"("tenant_id");

CREATE TABLE IF NOT EXISTS "school"."school_appearance_versions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "settings_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "published_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_appearance_versions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "school_appearance_versions_settings_id_version_key"
  ON "school"."school_appearance_versions"("settings_id", "version");
CREATE INDEX IF NOT EXISTS "school_appearance_versions_tenant_id_created_at_idx"
  ON "school"."school_appearance_versions"("tenant_id", "created_at");
ALTER TABLE "school"."school_appearance_versions"
  ADD CONSTRAINT "school_appearance_versions_settings_id_fkey"
  FOREIGN KEY ("settings_id") REFERENCES "school"."school_appearance_settings"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "school"."school_appearance_themes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "settings_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "snapshot" JSONB NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "school_appearance_themes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "school_appearance_themes_tenant_id_name_idx"
  ON "school"."school_appearance_themes"("tenant_id", "name");
ALTER TABLE "school"."school_appearance_themes"
  ADD CONSTRAINT "school_appearance_themes_settings_id_fkey"
  FOREIGN KEY ("settings_id") REFERENCES "school"."school_appearance_settings"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
