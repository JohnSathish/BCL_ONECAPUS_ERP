ALTER TABLE "academic"."alumni_association_settings"
ADD COLUMN IF NOT EXISTS "hero_images_json" JSONB;
