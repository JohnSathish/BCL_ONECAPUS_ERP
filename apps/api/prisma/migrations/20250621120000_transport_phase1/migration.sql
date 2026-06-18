-- Transport Phase 1 — routes, stops, vehicles, student assignments

CREATE TABLE IF NOT EXISTS "core"."transport_routes" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "start_point" TEXT,
  "end_point" TEXT,
  "fare_amount" DECIMAL(10,2),
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "transport_routes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "transport_routes_tenant_id_code_key"
  ON "core"."transport_routes"("tenant_id", "code");
CREATE INDEX IF NOT EXISTS "transport_routes_tenant_id_status_idx"
  ON "core"."transport_routes"("tenant_id", "status");

CREATE TABLE IF NOT EXISTS "core"."transport_route_stops" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "route_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "pickup_time" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "transport_route_stops_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "transport_route_stops_route_id_fkey"
    FOREIGN KEY ("route_id") REFERENCES "core"."transport_routes"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "transport_route_stops_tenant_id_route_id_idx"
  ON "core"."transport_route_stops"("tenant_id", "route_id");

CREATE TABLE IF NOT EXISTS "core"."transport_vehicles" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "registration_no" TEXT NOT NULL,
  "vehicle_type" TEXT NOT NULL DEFAULT 'BUS',
  "capacity" INTEGER NOT NULL DEFAULT 40,
  "driver_name" TEXT,
  "driver_mobile" TEXT,
  "route_id" UUID,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "transport_vehicles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "transport_vehicles_route_id_fkey"
    FOREIGN KEY ("route_id") REFERENCES "core"."transport_routes"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "transport_vehicles_tenant_id_registration_no_key"
  ON "core"."transport_vehicles"("tenant_id", "registration_no");
CREATE INDEX IF NOT EXISTS "transport_vehicles_tenant_id_route_id_idx"
  ON "core"."transport_vehicles"("tenant_id", "route_id");

CREATE TABLE IF NOT EXISTS "core"."transport_student_assignments" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "route_id" UUID NOT NULL,
  "stop_id" UUID,
  "academic_year_id" UUID,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "cancelled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "transport_student_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "transport_student_assignments_route_id_fkey"
    FOREIGN KEY ("route_id") REFERENCES "core"."transport_routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "transport_student_assignments_stop_id_fkey"
    FOREIGN KEY ("stop_id") REFERENCES "core"."transport_route_stops"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "transport_student_assignments_tenant_id_student_id_status_idx"
  ON "core"."transport_student_assignments"("tenant_id", "student_id", "status");
CREATE INDEX IF NOT EXISTS "transport_student_assignments_tenant_id_route_id_status_idx"
  ON "core"."transport_student_assignments"("tenant_id", "route_id", "status");

-- Transport Phase 2 (deferred from 20250608140000_transport_phase2)
ALTER TABLE "core"."transport_routes"
  ADD COLUMN IF NOT EXISTS "capacity_warning_percent" INTEGER NOT NULL DEFAULT 90;

ALTER TABLE "core"."transport_student_assignments"
  ADD COLUMN IF NOT EXISTS "assigned_by_user_id" UUID,
  ADD COLUMN IF NOT EXISTS "parent_notified_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "notification_status" TEXT;
