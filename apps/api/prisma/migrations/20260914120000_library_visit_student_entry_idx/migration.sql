CREATE INDEX IF NOT EXISTS "library_visits_tenant_id_student_id_entry_at_idx"
  ON "library"."library_visits"("tenant_id", "student_id", "entry_at");
