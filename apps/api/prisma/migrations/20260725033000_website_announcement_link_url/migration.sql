-- Optional click-through URL for website announcements (ticker / cards)
ALTER TABLE "academic"."website_announcements"
  ADD COLUMN IF NOT EXISTS "link_url" TEXT;
