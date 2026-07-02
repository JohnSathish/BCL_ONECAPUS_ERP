CREATE TABLE "academic"."academic_change_history" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "semester_id" UUID,
    "academic_year_id" UUID,
    "change_type" TEXT NOT NULL,
    "field_name" TEXT,
    "old_value" TEXT,
    "new_value" TEXT,
    "changed_by_id" UUID,
    "changed_by_name" TEXT,
    "changed_by_role" TEXT,
    "changed_on" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "ip_address" TEXT,
    "device_info" TEXT,
    "browser" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "academic_change_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "academic_change_history_tenant_id_student_id_changed_on_idx"
ON "academic"."academic_change_history"("tenant_id", "student_id", "changed_on");

CREATE INDEX "academic_change_history_tenant_id_change_type_changed_on_idx"
ON "academic"."academic_change_history"("tenant_id", "change_type", "changed_on");

ALTER TABLE "academic"."academic_change_history"
ADD CONSTRAINT "academic_change_history_student_id_fkey"
FOREIGN KEY ("student_id") REFERENCES "academic"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "academic"."academic_change_history"
ADD CONSTRAINT "academic_change_history_changed_by_id_fkey"
FOREIGN KEY ("changed_by_id") REFERENCES "platform"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
