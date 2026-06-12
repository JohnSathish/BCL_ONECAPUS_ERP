ALTER TABLE "academic"."room_types"
ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE';

CREATE TABLE "academic"."infrastructure_buildings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "campus_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "infrastructure_buildings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."infrastructure_floors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "building_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "floor_number" INTEGER,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "infrastructure_floors_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "academic"."classrooms"
ADD COLUMN IF NOT EXISTS "building_id" UUID,
ADD COLUMN IF NOT EXISTS "floor_id" UUID,
ADD COLUMN IF NOT EXISTS "short_name" TEXT,
ADD COLUMN IF NOT EXISTS "description" TEXT,
ADD COLUMN IF NOT EXISTS "practical_capacity" INTEGER,
ADD COLUMN IF NOT EXISTS "exam_capacity" INTEGER,
ADD COLUMN IF NOT EXISTS "standing_capacity" INTEGER,
ADD COLUMN IF NOT EXISTS "shift_availability" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN IF NOT EXISTS "department_restriction_mode" TEXT NOT NULL DEFAULT 'ALL',
ADD COLUMN IF NOT EXISTS "restricted_department_ids" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN IF NOT EXISTS "preferred_department_ids" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN IF NOT EXISTS "facilities" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN IF NOT EXISTS "available_for_timetable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "available_for_attendance" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "available_for_exams" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "available_for_workshops" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "available_for_seminars" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "available_for_combined" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "is_shared_hall" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "is_practical_lab" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "supports_mdc" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "supports_vac" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "supports_aec" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "supports_sec" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "supported_categories" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN IF NOT EXISTS "metadata" JSONB NOT NULL DEFAULT '{}';

CREATE TABLE "academic"."infrastructure_reservations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "classroom_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'GENERAL',
    "source_module" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RESERVED',
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "requested_by_id" UUID,
    "approved_by_id" UUID,
    "approved_at" TIMESTAMP(3),
    "remarks" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "infrastructure_reservations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."infrastructure_audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "actor_id" UUID,
    "entity" TEXT NOT NULL,
    "entity_id" UUID,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "infrastructure_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "infrastructure_buildings_tenant_id_code_key"
ON "academic"."infrastructure_buildings"("tenant_id", "code");
CREATE INDEX "infrastructure_buildings_tenant_id_idx"
ON "academic"."infrastructure_buildings"("tenant_id");
CREATE INDEX "infrastructure_buildings_campus_id_idx"
ON "academic"."infrastructure_buildings"("campus_id");

CREATE UNIQUE INDEX "infrastructure_floors_building_id_name_key"
ON "academic"."infrastructure_floors"("building_id", "name");
CREATE INDEX "infrastructure_floors_tenant_id_idx"
ON "academic"."infrastructure_floors"("tenant_id");
CREATE INDEX "infrastructure_floors_building_id_idx"
ON "academic"."infrastructure_floors"("building_id");

CREATE INDEX "classrooms_building_id_idx"
ON "academic"."classrooms"("building_id");
CREATE INDEX "classrooms_floor_id_idx"
ON "academic"."classrooms"("floor_id");
CREATE INDEX "classrooms_status_idx"
ON "academic"."classrooms"("status");

CREATE INDEX "infrastructure_reservations_tenant_id_classroom_id_start_at_end_at_idx"
ON "academic"."infrastructure_reservations"("tenant_id", "classroom_id", "start_at", "end_at");
CREATE INDEX "infrastructure_reservations_tenant_id_status_idx"
ON "academic"."infrastructure_reservations"("tenant_id", "status");

CREATE INDEX "infrastructure_audit_logs_tenant_id_entity_entity_id_idx"
ON "academic"."infrastructure_audit_logs"("tenant_id", "entity", "entity_id");
CREATE INDEX "infrastructure_audit_logs_tenant_id_actor_id_idx"
ON "academic"."infrastructure_audit_logs"("tenant_id", "actor_id");
CREATE INDEX "infrastructure_audit_logs_tenant_id_action_idx"
ON "academic"."infrastructure_audit_logs"("tenant_id", "action");

INSERT INTO "platform"."permissions" ("id", "slug", "resource", "action", "description", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'infrastructure:view', 'infrastructure', 'view', 'View infrastructure master data', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'infrastructure:create', 'infrastructure', 'create', 'Create infrastructure master data', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'infrastructure:edit', 'infrastructure', 'edit', 'Edit infrastructure master data', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'infrastructure:delete', 'infrastructure', 'delete', 'Archive infrastructure master data', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'infrastructure:import', 'infrastructure', 'import', 'Import infrastructure rooms', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'infrastructure:export', 'infrastructure', 'export', 'Export infrastructure rooms', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'infrastructure:assign', 'infrastructure', 'assign', 'Assign or reserve infrastructure resources', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'infrastructure:reports', 'infrastructure', 'reports', 'View infrastructure reports', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'infrastructure:admin', 'infrastructure', 'admin', 'Administer infrastructure settings and audit logs', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;
