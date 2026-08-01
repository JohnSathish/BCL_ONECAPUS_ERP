-- Login notice board config for mobile pre-auth screens (banner + Today's Updates).
ALTER TABLE "platform"."mobile_app_settings"
ADD COLUMN IF NOT EXISTS "login_notices" JSONB NOT NULL DEFAULT '{}'::jsonb;
