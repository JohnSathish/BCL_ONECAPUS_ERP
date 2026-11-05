-- Optional actual board name when Class XII board is Others.
-- Existing rows stay unchanged; the column is nullable.
ALTER TABLE "academic"."student_board_exams"
ADD COLUMN IF NOT EXISTS "board_name_other" TEXT;
