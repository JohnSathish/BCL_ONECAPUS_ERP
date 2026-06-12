-- Student bulk photo upload batches and row-level preview/apply history

CREATE TABLE IF NOT EXISTS "academic"."student_photo_bulk_batches" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PREVIEWED',
    "upload_mode" TEXT NOT NULL DEFAULT 'FILES',
    "identifier_strategy" TEXT NOT NULL DEFAULT 'rollNumber',
    "normalization" JSONB NOT NULL DEFAULT '{"ignoreExtension":true,"ignoreSpaces":true,"ignoreCase":true,"stripSpecialCharacters":false}',
    "scope_filter" JSONB,
    "conflict_strategy" TEXT NOT NULL DEFAULT 'SKIP_EXISTING',
    "duplicate_strategy" TEXT NOT NULL DEFAULT 'LATEST',
    "crop_mode" TEXT NOT NULL DEFAULT 'COVER',
    "total_files" INTEGER NOT NULL DEFAULT 0,
    "matched_count" INTEGER NOT NULL DEFAULT 0,
    "unmatched_count" INTEGER NOT NULL DEFAULT 0,
    "duplicate_count" INTEGER NOT NULL DEFAULT 0,
    "missing_count" INTEGER NOT NULL DEFAULT 0,
    "assigned_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "report_path" TEXT,
    "actor_id" UUID,
    "ip_address" TEXT,
    "applied_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "student_photo_bulk_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "academic"."student_photo_bulk_changes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "student_id" UUID,
    "file_name" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "identifier" TEXT,
    "old_photo_path" TEXT,
    "new_photo_path" TEXT,
    "staged_path" TEXT,
    "thumbnail_path" TEXT,
    "mime_type" TEXT,
    "checksum" TEXT,
    "file_size" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'MATCHED',
    "error_message" TEXT,
    "duplicate_group" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "student_photo_bulk_changes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "student_photo_bulk_batches_tenant_id_created_at_idx" ON "academic"."student_photo_bulk_batches"("tenant_id", "created_at");
CREATE INDEX IF NOT EXISTS "student_photo_bulk_changes_batch_id_idx" ON "academic"."student_photo_bulk_changes"("batch_id");
CREATE INDEX IF NOT EXISTS "student_photo_bulk_changes_tenant_id_student_id_idx" ON "academic"."student_photo_bulk_changes"("tenant_id", "student_id");
CREATE INDEX IF NOT EXISTS "student_photo_bulk_changes_tenant_id_status_idx" ON "academic"."student_photo_bulk_changes"("tenant_id", "status");

ALTER TABLE "academic"."student_photo_bulk_batches" ADD CONSTRAINT "student_photo_bulk_batches_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "platform"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "academic"."student_photo_bulk_changes" ADD CONSTRAINT "student_photo_bulk_changes_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "academic"."student_photo_bulk_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."student_photo_bulk_changes" ADD CONSTRAINT "student_photo_bulk_changes_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "academic"."students"("id") ON DELETE SET NULL ON UPDATE CASCADE;
