-- CreateTable
CREATE TABLE "platform"."app_theme_settings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "theme_name" TEXT NOT NULL DEFAULT 'dbc-classic',
    "primary_color" TEXT,
    "sidebar_bg" TEXT,
    "sidebar_text" TEXT,
    "sidebar_active" TEXT,
    "topbar_bg" TEXT,
    "card_bg" TEXT,
    "border_color" TEXT,
    "accent_color" TEXT,
    "font_family" TEXT,
    "logo_url" TEXT,
    "dark_mode_enabled" BOOLEAN NOT NULL DEFAULT true,
    "compact_sidebar" BOOLEAN NOT NULL DEFAULT false,
    "rounded_style" TEXT NOT NULL DEFAULT 'xl',
    "appearance_mode" TEXT NOT NULL DEFAULT 'system',
    "layout_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_theme_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."campus_theme_settings" (
    "id" UUID NOT NULL,
    "campus_id" UUID NOT NULL,
    "overrides" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campus_theme_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_theme_settings_tenant_id_key" ON "platform"."app_theme_settings"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "campus_theme_settings_campus_id_key" ON "core"."campus_theme_settings"("campus_id");

-- AddForeignKey
ALTER TABLE "platform"."app_theme_settings" ADD CONSTRAINT "app_theme_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."campus_theme_settings" ADD CONSTRAINT "campus_theme_settings_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "core"."campuses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed from existing tenant_branding
INSERT INTO "platform"."app_theme_settings" (
    "id",
    "tenant_id",
    "theme_name",
    "primary_color",
    "sidebar_bg",
    "accent_color",
    "updated_at"
)
SELECT
    gen_random_uuid(),
    tb."tenant_id",
    'dbc-classic',
    tb."primary_color",
    tb."sidebar_color",
    tb."accent_color",
    CURRENT_TIMESTAMP
FROM "platform"."tenant_branding" tb
ON CONFLICT ("tenant_id") DO NOTHING;
