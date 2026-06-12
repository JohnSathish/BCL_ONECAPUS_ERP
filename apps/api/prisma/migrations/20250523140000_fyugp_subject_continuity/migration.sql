-- FYUGP subject continuity: major/minor track lock, VTC track, course VTC metadata

ALTER TABLE "academic"."courses"
  ADD COLUMN IF NOT EXISTS "vtc_track_group_code" TEXT,
  ADD COLUMN IF NOT EXISTS "vtc_track_stage" INTEGER;

CREATE INDEX IF NOT EXISTS "courses_vtc_track_group_code_idx"
  ON "academic"."courses" ("vtc_track_group_code");

CREATE TABLE IF NOT EXISTS "academic"."student_major_minor_tracks" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "major_subject_id" UUID NOT NULL,
  "minor_subject_id" UUID,
  "locked_at_semester" INTEGER,
  "is_track_locked" BOOLEAN NOT NULL DEFAULT false,
  "locked_at" TIMESTAMP(3),
  "locked_by_promotion_run_id" UUID,
  "unlock_reason" TEXT,
  "unlocked_at" TIMESTAMP(3),
  "unlocked_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "student_major_minor_tracks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "student_major_minor_tracks_student_id_key"
  ON "academic"."student_major_minor_tracks" ("student_id");
CREATE INDEX IF NOT EXISTS "student_major_minor_tracks_tenant_id_idx"
  ON "academic"."student_major_minor_tracks" ("tenant_id");
CREATE INDEX IF NOT EXISTS "student_major_minor_tracks_student_id_idx"
  ON "academic"."student_major_minor_tracks" ("student_id");

ALTER TABLE "academic"."student_major_minor_tracks"
  ADD CONSTRAINT "student_major_minor_tracks_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "academic"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."student_major_minor_tracks"
  ADD CONSTRAINT "student_major_minor_tracks_major_subject_id_fkey"
  FOREIGN KEY ("major_subject_id") REFERENCES "academic"."academic_subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "academic"."student_major_minor_tracks"
  ADD CONSTRAINT "student_major_minor_tracks_minor_subject_id_fkey"
  FOREIGN KEY ("minor_subject_id") REFERENCES "academic"."academic_subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "academic"."student_major_minor_tracks"
  ADD CONSTRAINT "student_major_minor_tracks_unlocked_by_id_fkey"
  FOREIGN KEY ("unlocked_by_id") REFERENCES "platform"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "academic"."student_vtc_tracks" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "track_group_code" TEXT NOT NULL,
  "selected_sem3_offering_id" UUID,
  "selected_sem4_offering_id" UUID,
  "selected_sem6_offering_id" UUID,
  "locked_at_semester" INTEGER NOT NULL DEFAULT 3,
  "reset_reason" TEXT,
  "reset_at" TIMESTAMP(3),
  "reset_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "student_vtc_tracks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "student_vtc_tracks_student_id_key"
  ON "academic"."student_vtc_tracks" ("student_id");
CREATE INDEX IF NOT EXISTS "student_vtc_tracks_tenant_id_idx"
  ON "academic"."student_vtc_tracks" ("tenant_id");
CREATE INDEX IF NOT EXISTS "student_vtc_tracks_student_id_idx"
  ON "academic"."student_vtc_tracks" ("student_id");
CREATE INDEX IF NOT EXISTS "student_vtc_tracks_track_group_code_idx"
  ON "academic"."student_vtc_tracks" ("track_group_code");

ALTER TABLE "academic"."student_vtc_tracks"
  ADD CONSTRAINT "student_vtc_tracks_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "academic"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."student_vtc_tracks"
  ADD CONSTRAINT "student_vtc_tracks_selected_sem3_offering_id_fkey"
  FOREIGN KEY ("selected_sem3_offering_id") REFERENCES "academic"."course_offerings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "academic"."student_vtc_tracks"
  ADD CONSTRAINT "student_vtc_tracks_selected_sem4_offering_id_fkey"
  FOREIGN KEY ("selected_sem4_offering_id") REFERENCES "academic"."course_offerings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "academic"."student_vtc_tracks"
  ADD CONSTRAINT "student_vtc_tracks_selected_sem6_offering_id_fkey"
  FOREIGN KEY ("selected_sem6_offering_id") REFERENCES "academic"."course_offerings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "academic"."student_vtc_tracks"
  ADD CONSTRAINT "student_vtc_tracks_reset_by_id_fkey"
  FOREIGN KEY ("reset_by_id") REFERENCES "platform"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
