-- Student lifecycle events, remarks, import batch tracking

ALTER TABLE "academic"."students"
  ADD COLUMN IF NOT EXISTS "import_batch_id" UUID;

CREATE INDEX IF NOT EXISTS "students_import_batch_id_idx"
  ON "academic"."students"("import_batch_id");

CREATE TABLE IF NOT EXISTS "academic"."student_lifecycle_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "event_type" TEXT NOT NULL,
  "effective_date" DATE NOT NULL,
  "reason" TEXT,
  "document_id" UUID,
  "actor_id" UUID,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_lifecycle_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "student_lifecycle_events_tenant_student_created_idx"
  ON "academic"."student_lifecycle_events"("tenant_id", "student_id", "created_at");

CREATE INDEX IF NOT EXISTS "student_lifecycle_events_tenant_event_type_idx"
  ON "academic"."student_lifecycle_events"("tenant_id", "event_type");

ALTER TABLE "academic"."student_lifecycle_events"
  ADD CONSTRAINT "student_lifecycle_events_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "academic"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "academic"."student_lifecycle_events"
  ADD CONSTRAINT "student_lifecycle_events_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "platform"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "academic"."student_remarks" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "remark_type" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "visibility" TEXT NOT NULL DEFAULT 'INTERNAL',
  "actor_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_remarks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "student_remarks_tenant_student_created_idx"
  ON "academic"."student_remarks"("tenant_id", "student_id", "created_at");

ALTER TABLE "academic"."student_remarks"
  ADD CONSTRAINT "student_remarks_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "academic"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "academic"."student_remarks"
  ADD CONSTRAINT "student_remarks_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "platform"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
