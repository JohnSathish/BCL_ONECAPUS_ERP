-- Lateral Sem 7+ entry: previous NEHU-affiliated college name
ALTER TABLE "academic"."student_academic_profiles"
ADD COLUMN IF NOT EXISTS "previous_college_name" TEXT;
