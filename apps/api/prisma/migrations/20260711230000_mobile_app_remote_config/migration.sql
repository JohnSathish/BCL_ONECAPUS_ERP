-- Extend mobile app settings for remote config / force update.

ALTER TABLE platform.mobile_app_settings
  ADD COLUMN IF NOT EXISTS play_store_url TEXT,
  ADD COLUMN IF NOT EXISTS apk_download_url TEXT,
  ADD COLUMN IF NOT EXISTS release_notes TEXT,
  ADD COLUMN IF NOT EXISTS feature_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS config_version INTEGER NOT NULL DEFAULT 1;
