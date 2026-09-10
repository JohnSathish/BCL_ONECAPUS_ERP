-- Optional school house (Red / Blue / etc.). Not the residential house number.

ALTER TABLE "school"."school_students"
  ADD COLUMN IF NOT EXISTS "house" TEXT;
