-- AlterTable app_theme_settings
ALTER TABLE "platform"."app_theme_settings"
ADD COLUMN IF NOT EXISTS "custom_css" TEXT,
ADD COLUMN IF NOT EXISTS "custom_css_enabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable users
ALTER TABLE "platform"."users"
ADD COLUMN IF NOT EXISTS "appearance_mode" TEXT NOT NULL DEFAULT 'system';

-- Rename legacy preset ids
UPDATE "platform"."app_theme_settings" SET "theme_name" = 'indigo-pro' WHERE "theme_name" = 'modern-indigo';
UPDATE "platform"."app_theme_settings" SET "theme_name" = 'midnight' WHERE "theme_name" = 'midnight-erp';
UPDATE "platform"."app_theme_settings" SET "theme_name" = 'slate-erp' WHERE "theme_name" = 'slate-professional';
