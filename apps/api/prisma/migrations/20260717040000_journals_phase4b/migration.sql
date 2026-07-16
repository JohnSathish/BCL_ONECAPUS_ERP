-- Journals Phase 4b: reviewer conflict-of-interest on assignments
ALTER TABLE "academic"."journal_review_assignments"
  ADD COLUMN IF NOT EXISTS "conflict_of_interest" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "conflict_of_interest_notes" TEXT;
