-- LMS Module Phase 1

CREATE TABLE "academic"."lms_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "max_upload_mb" INTEGER NOT NULL DEFAULT 50,
    "allowed_mime_types" JSONB NOT NULL DEFAULT '[]',
    "pool_workspaces_enabled" BOOLEAN NOT NULL DEFAULT true,
    "default_visibility" TEXT NOT NULL DEFAULT 'ENROLLED',
    "feature_flags" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lms_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lms_settings_tenant_id_key" ON "academic"."lms_settings"("tenant_id");

CREATE TABLE "academic"."lms_workspaces" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "workspace_type" TEXT NOT NULL,
    "offering_section_id" UUID,
    "course_offering_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "semester_no" INTEGER NOT NULL,
    "shift_id" UUID,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "lms_workspaces_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lms_workspaces_offering_section_id_key" ON "academic"."lms_workspaces"("offering_section_id");
CREATE INDEX "lms_workspaces_tenant_id_semester_no_idx" ON "academic"."lms_workspaces"("tenant_id", "semester_no");
CREATE INDEX "lms_workspaces_tenant_id_course_id_idx" ON "academic"."lms_workspaces"("tenant_id", "course_id");
CREATE INDEX "lms_workspaces_tenant_id_status_idx" ON "academic"."lms_workspaces"("tenant_id", "status");

ALTER TABLE "academic"."lms_workspaces" ADD CONSTRAINT "lms_workspaces_offering_section_id_fkey" FOREIGN KEY ("offering_section_id") REFERENCES "academic"."offering_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."lms_workspaces" ADD CONSTRAINT "lms_workspaces_course_offering_id_fkey" FOREIGN KEY ("course_offering_id") REFERENCES "academic"."course_offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."lms_workspaces" ADD CONSTRAINT "lms_workspaces_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "academic"."courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "academic"."lms_workspaces" ADD CONSTRAINT "lms_workspaces_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "core"."shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DO $$ BEGIN
  ALTER TABLE "academic"."lms_assignments"
    ADD CONSTRAINT "lms_assignments_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "academic"."lms_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE "academic"."lms_materials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "unit" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'ENROLLED',
    "file_path" TEXT,
    "external_url" TEXT,
    "mime_type" TEXT,
    "file_size" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "parent_material_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "publish_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "uploaded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "lms_materials_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lms_materials_tenant_id_workspace_id_status_idx" ON "academic"."lms_materials"("tenant_id", "workspace_id", "status");
CREATE INDEX "lms_materials_tenant_id_category_idx" ON "academic"."lms_materials"("tenant_id", "category");

ALTER TABLE "academic"."lms_materials" ADD CONSTRAINT "lms_materials_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "academic"."lms_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."lms_materials" ADD CONSTRAINT "lms_materials_parent_material_id_fkey" FOREIGN KEY ("parent_material_id") REFERENCES "academic"."lms_materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "academic"."lms_materials" ADD CONSTRAINT "lms_materials_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "platform"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "academic"."lms_material_bookmarks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "material_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lms_material_bookmarks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lms_material_bookmarks_student_id_material_id_key" ON "academic"."lms_material_bookmarks"("student_id", "material_id");
CREATE INDEX "lms_material_bookmarks_tenant_id_student_id_idx" ON "academic"."lms_material_bookmarks"("tenant_id", "student_id");

ALTER TABLE "academic"."lms_material_bookmarks" ADD CONSTRAINT "lms_material_bookmarks_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "academic"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."lms_material_bookmarks" ADD CONSTRAINT "lms_material_bookmarks_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "academic"."lms_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "academic"."lms_announcements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "workspace_id" UUID,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'NOTICE',
    "audience" TEXT NOT NULL DEFAULT 'WORKSPACE',
    "publish_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "lms_announcements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lms_announcements_tenant_id_workspace_id_publish_at_idx" ON "academic"."lms_announcements"("tenant_id", "workspace_id", "publish_at");

ALTER TABLE "academic"."lms_announcements" ADD CONSTRAINT "lms_announcements_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "academic"."lms_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."lms_announcements" ADD CONSTRAINT "lms_announcements_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "platform"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "academic"."lms_lesson_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "unit" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "subtopic" TEXT,
    "learning_outcomes" TEXT,
    "expected_hours" DECIMAL(5,2),
    "teaching_method" TEXT,
    "resources" JSONB,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "scheduled_date" DATE,
    "timetable_entry_id" UUID,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "lms_lesson_plans_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lms_lesson_plans_tenant_id_workspace_id_status_idx" ON "academic"."lms_lesson_plans"("tenant_id", "workspace_id", "status");

ALTER TABLE "academic"."lms_lesson_plans" ADD CONSTRAINT "lms_lesson_plans_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "academic"."lms_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."lms_lesson_plans" ADD CONSTRAINT "lms_lesson_plans_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "platform"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "academic"."lms_audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "workspace_id" UUID,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID,
    "action" TEXT NOT NULL,
    "actor_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lms_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lms_audit_logs_tenant_id_workspace_id_created_at_idx" ON "academic"."lms_audit_logs"("tenant_id", "workspace_id", "created_at");
CREATE INDEX "lms_audit_logs_tenant_id_entity_type_entity_id_idx" ON "academic"."lms_audit_logs"("tenant_id", "entity_type", "entity_id");

ALTER TABLE "academic"."lms_audit_logs" ADD CONSTRAINT "lms_audit_logs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "academic"."lms_workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "academic"."lms_audit_logs" ADD CONSTRAINT "lms_audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "platform"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- LMS permissions
INSERT INTO "platform"."permissions" ("id", "slug", "resource", "action", "description", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'lms:read', 'lms', 'read', 'View LMS workspaces and content', NOW(), NOW()),
  (gen_random_uuid(), 'lms:manage', 'lms', 'manage', 'Manage LMS administration', NOW(), NOW()),
  (gen_random_uuid(), 'lms:workspace:manage', 'lms', 'workspace:manage', 'Manage LMS workspaces', NOW(), NOW()),
  (gen_random_uuid(), 'lms:materials:upload', 'lms', 'materials:upload', 'Upload LMS materials', NOW(), NOW()),
  (gen_random_uuid(), 'lms:materials:publish', 'lms', 'materials:publish', 'Publish LMS materials', NOW(), NOW()),
  (gen_random_uuid(), 'lms:announcements:publish', 'lms', 'announcements:publish', 'Publish LMS announcements', NOW(), NOW()),
  (gen_random_uuid(), 'lms:lesson-plans:manage', 'lms', 'lesson-plans:manage', 'Manage LMS lesson plans', NOW(), NOW()),
  (gen_random_uuid(), 'lms:analytics:read', 'lms', 'analytics:read', 'View LMS analytics', NOW(), NOW()),
  (gen_random_uuid(), 'lms:settings:manage', 'lms', 'settings:manage', 'Manage LMS settings', NOW(), NOW())
ON CONFLICT ("slug") DO NOTHING;
