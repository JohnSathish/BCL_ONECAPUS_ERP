-- School SIS transport (schema school). Creates fleet tables if missing, then extras.

CREATE TABLE IF NOT EXISTS "school"."school_transport_settings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "transport_name" TEXT NOT NULL DEFAULT 'School Transport',
    "manager_name" TEXT,
    "emergency_contact" TEXT,
    "emergency_contacts_json" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "trip_start_buffer_minutes" INTEGER NOT NULL DEFAULT 10,
    "gps_enabled" BOOLEAN NOT NULL DEFAULT false,
    "gps_provider" TEXT NOT NULL DEFAULT 'NONE',
    "map_provider" TEXT NOT NULL DEFAULT 'OSM',
    "map_api_key" TEXT,
    "gps_offline_minutes" INTEGER NOT NULL DEFAULT 5,
    "overspeed_kmh" INTEGER NOT NULL DEFAULT 40,
    "long_stop_minutes" INTEGER NOT NULL DEFAULT 10,
    "geofence_default_meters" INTEGER NOT NULL DEFAULT 80,
    "document_remind_days" JSONB NOT NULL DEFAULT '[7, 15, 30]'::jsonb,
    "allow_capacity_override" BOOLEAN NOT NULL DEFAULT false,
    "require_capacity_approval" BOOLEAN NOT NULL DEFAULT true,
    "require_valid_documents" BOOLEAN NOT NULL DEFAULT true,
    "block_expired_driver" BOOLEAN NOT NULL DEFAULT true,
    "allow_driver_override" BOOLEAN NOT NULL DEFAULT false,
    "attendance_provider" TEXT NOT NULL DEFAULT 'MANUAL',
    "notify_parents" BOOLEAN NOT NULL DEFAULT true,
    "notify_sms" BOOLEAN NOT NULL DEFAULT false,
    "notify_whatsapp" BOOLEAN NOT NULL DEFAULT false,
    "notify_email" BOOLEAN NOT NULL DEFAULT false,
    "notify_push" BOOLEAN NOT NULL DEFAULT true,
    "pre_trip_checklist_required" BOOLEAN NOT NULL DEFAULT true,
    "post_trip_checklist_required" BOOLEAN NOT NULL DEFAULT false,
    "mandatory_ack_missing" BOOLEAN NOT NULL DEFAULT true,
    "block_dispatch_on_fail" BOOLEAN NOT NULL DEFAULT true,
    "allow_safety_override" BOOLEAN NOT NULL DEFAULT true,
    "approaching_stop_meters" INTEGER NOT NULL DEFAULT 250,
    "policy_json" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_transport_settings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "school_transport_settings_tenant_id_key"
  ON "school"."school_transport_settings"("tenant_id");

CREATE TABLE IF NOT EXISTS "school"."school_transport_vehicles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "registration_number" TEXT NOT NULL,
    "vehicle_type" TEXT NOT NULL DEFAULT 'SCHOOL_BUS',
    "make" TEXT,
    "model" TEXT,
    "year" INTEGER,
    "colour" TEXT,
    "seating_capacity" INTEGER NOT NULL DEFAULT 0,
    "standing_capacity" INTEGER NOT NULL DEFAULT 0,
    "total_capacity" INTEGER NOT NULL DEFAULT 0,
    "ownership" TEXT NOT NULL DEFAULT 'SCHOOL_OWNED',
    "operator" TEXT,
    "fuel_type" TEXT,
    "odometer" INTEGER NOT NULL DEFAULT 0,
    "gps_device_id" TEXT,
    "insurance_number" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "fleet_role" TEXT NOT NULL DEFAULT 'PRIMARY',
    "photo_url" TEXT,
    "remarks" TEXT,
    "details_json" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "school_transport_vehicles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "school_transport_vehicles_tenant_id_code_key"
  ON "school"."school_transport_vehicles"("tenant_id", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "school_transport_vehicles_tenant_id_registration_number_key"
  ON "school"."school_transport_vehicles"("tenant_id", "registration_number");
CREATE INDEX IF NOT EXISTS "school_transport_vehicles_tenant_id_status_idx"
  ON "school"."school_transport_vehicles"("tenant_id", "status");

CREATE TABLE IF NOT EXISTS "school"."school_transport_vehicle_documents" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "document_number" TEXT,
    "issue_date" DATE,
    "expiry_date" DATE,
    "attachment_url" TEXT,
    "remarks" TEXT,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "school_transport_vehicle_documents_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "school_transport_vehicle_documents_tenant_id_vehicle_id_kind_idx"
  ON "school"."school_transport_vehicle_documents"("tenant_id", "vehicle_id", "kind");
CREATE INDEX IF NOT EXISTS "school_transport_vehicle_documents_tenant_id_expiry_date_idx"
  ON "school"."school_transport_vehicle_documents"("tenant_id", "expiry_date");

CREATE TABLE IF NOT EXISTS "school"."school_transport_vehicle_safety_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "last_inspection" DATE,
    "next_inspection" DATE,
    "inspected_by" TEXT,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_transport_vehicle_safety_items_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "school_transport_vehicle_safety_items_vehicle_id_code_key"
  ON "school"."school_transport_vehicle_safety_items"("vehicle_id", "code");

CREATE TABLE IF NOT EXISTS "school"."school_transport_stops" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "area" TEXT,
    "landmark" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "geofence_meters" INTEGER,
    "morning_pickup" TEXT,
    "afternoon_drop" TEXT,
    "max_students" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "safety_json" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "school_transport_stops_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "school_transport_stops_tenant_id_code_key"
  ON "school"."school_transport_stops"("tenant_id", "code");
CREATE INDEX IF NOT EXISTS "school_transport_stops_tenant_id_status_area_idx"
  ON "school"."school_transport_stops"("tenant_id", "status", "area");

CREATE TABLE IF NOT EXISTS "school"."school_transport_personnel" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "employment" TEXT NOT NULL DEFAULT 'SCHOOL_STAFF',
    "staff_id" UUID,
    "code" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "photo_url" TEXT,
    "mobile" TEXT,
    "alternate_mobile" TEXT,
    "address" TEXT,
    "date_of_birth" DATE,
    "emergency_contact" TEXT,
    "blood_group" TEXT,
    "license_number" TEXT,
    "license_type" TEXT,
    "license_issue_date" DATE,
    "license_expiry" DATE,
    "experience_years" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "school_transport_personnel_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "school_transport_personnel_tenant_id_code_key"
  ON "school"."school_transport_personnel"("tenant_id", "code");
CREATE INDEX IF NOT EXISTS "school_transport_personnel_tenant_id_kind_status_idx"
  ON "school"."school_transport_personnel"("tenant_id", "kind", "status");

CREATE TABLE IF NOT EXISTS "school"."school_transport_personnel_documents" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "personnel_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "document_number" TEXT,
    "issue_date" DATE,
    "expiry_date" DATE,
    "attachment_url" TEXT,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "school_transport_personnel_documents_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "school_transport_personnel_documents_tenant_id_personnel_id_kind_idx"
  ON "school"."school_transport_personnel_documents"("tenant_id", "personnel_id", "kind");
CREATE INDEX IF NOT EXISTS "school_transport_personnel_documents_tenant_id_expiry_date_idx"
  ON "school"."school_transport_personnel_documents"("tenant_id", "expiry_date");

CREATE TABLE IF NOT EXISTS "school"."school_transport_routes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'BOTH',
    "morning_start_time" TEXT,
    "school_arrival_time" TEXT,
    "afternoon_departure_time" TEXT,
    "expected_completion_time" TEXT,
    "distance_km" DECIMAL(8,2),
    "estimated_minutes" INTEGER,
    "route_type" TEXT NOT NULL DEFAULT 'BOTH',
    "start_point" TEXT,
    "end_point" TEXT,
    "max_capacity" INTEGER,
    "vehicle_id" UUID,
    "driver_id" UUID,
    "attendant_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "polyline_json" JSONB,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "school_transport_routes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "school_transport_routes_tenant_id_code_key"
  ON "school"."school_transport_routes"("tenant_id", "code");
CREATE INDEX IF NOT EXISTS "school_transport_routes_tenant_id_status_idx"
  ON "school"."school_transport_routes"("tenant_id", "status");

CREATE TABLE IF NOT EXISTS "school"."school_transport_route_stops" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "route_id" UUID NOT NULL,
    "stop_id" UUID NOT NULL,
    "stop_number" INTEGER NOT NULL,
    "pickup_time" TEXT,
    "drop_time" TEXT,
    "distance_from_prev_km" DECIMAL(8,2),
    "expected_students" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "school_transport_route_stops_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "school_transport_route_stops_route_id_stop_id_key"
  ON "school"."school_transport_route_stops"("route_id", "stop_id");
CREATE UNIQUE INDEX IF NOT EXISTS "school_transport_route_stops_route_id_stop_number_key"
  ON "school"."school_transport_route_stops"("route_id", "stop_number");
CREATE INDEX IF NOT EXISTS "school_transport_route_stops_tenant_id_route_id_idx"
  ON "school"."school_transport_route_stops"("tenant_id", "route_id");

CREATE TABLE IF NOT EXISTS "school"."school_transport_duty_assignments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "academic_year_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "session" TEXT NOT NULL DEFAULT 'MORNING',
    "route_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "driver_id" UUID NOT NULL,
    "attendant_id" UUID,
    "substitute_driver_id" UUID,
    "substitute_reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_transport_duty_assignments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "school_transport_duty_assignments_tenant_id_date_session_idx"
  ON "school"."school_transport_duty_assignments"("tenant_id", "date", "session");
CREATE INDEX IF NOT EXISTS "school_transport_duty_assignments_tenant_id_route_id_date_idx"
  ON "school"."school_transport_duty_assignments"("tenant_id", "route_id", "date");

CREATE TABLE IF NOT EXISTS "school"."school_transport_fee_plans" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "academic_year_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "cadence" TEXT NOT NULL DEFAULT 'MONTHLY',
    "pricing_model" TEXT NOT NULL DEFAULT 'ROUTE',
    "amount" INTEGER NOT NULL DEFAULT 0,
    "route_id" UUID,
    "stop_id" UUID,
    "min_distance_km" DECIMAL(8,2),
    "max_distance_km" DECIMAL(8,2),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "school_transport_fee_plans_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "school_transport_fee_plans_tenant_id_academic_year_id_code_key"
  ON "school"."school_transport_fee_plans"("tenant_id", "academic_year_id", "code");
CREATE INDEX IF NOT EXISTS "school_transport_fee_plans_tenant_id_academic_year_id_active_idx"
  ON "school"."school_transport_fee_plans"("tenant_id", "academic_year_id", "active");

CREATE TABLE IF NOT EXISTS "school"."school_transport_fee_concessions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "plan_id" UUID,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "percent" DECIMAL(6,2),
    "amount" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_transport_fee_concessions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "school_transport_fee_concessions_tenant_id_kind_idx"
  ON "school"."school_transport_fee_concessions"("tenant_id", "kind");

CREATE TABLE IF NOT EXISTS "school"."school_transport_student_allocations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "academic_year_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "route_id" UUID NOT NULL,
    "vehicle_id" UUID,
    "pickup_stop_id" UUID NOT NULL,
    "drop_stop_id" UUID NOT NULL,
    "morning_pickup" TEXT,
    "afternoon_drop" TEXT,
    "valid_from" DATE NOT NULL,
    "valid_until" DATE,
    "fee_plan_id" UUID,
    "concession_kind" TEXT,
    "sibling_same_route" BOOLEAN NOT NULL DEFAULT false,
    "capacity_override" BOOLEAN NOT NULL DEFAULT false,
    "override_reason" TEXT,
    "trip_mode" TEXT NOT NULL DEFAULT 'BOTH',
    "is_temporary" BOOLEAN NOT NULL DEFAULT false,
    "temporary_reason" TEXT,
    "remarks" TEXT,
    "qr_token" TEXT,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "school_transport_student_allocations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "school_transport_student_allocations_qr_token_key"
  ON "school"."school_transport_student_allocations"("qr_token");
CREATE INDEX IF NOT EXISTS "school_transport_student_allocations_tenant_id_academic_year_id_status_idx"
  ON "school"."school_transport_student_allocations"("tenant_id", "academic_year_id", "status");
CREATE INDEX IF NOT EXISTS "school_transport_student_allocations_tenant_id_student_id_status_idx"
  ON "school"."school_transport_student_allocations"("tenant_id", "student_id", "status");
CREATE INDEX IF NOT EXISTS "school_transport_student_allocations_tenant_id_route_id_status_idx"
  ON "school"."school_transport_student_allocations"("tenant_id", "route_id", "status");
CREATE INDEX IF NOT EXISTS "school_transport_student_allocations_tenant_id_pickup_stop_id_idx"
  ON "school"."school_transport_student_allocations"("tenant_id", "pickup_stop_id");

CREATE TABLE IF NOT EXISTS "school"."school_transport_allocation_history" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "allocation_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "route_id" UUID,
    "vehicle_id" UUID,
    "pickup_stop_id" UUID,
    "drop_stop_id" UUID,
    "status" TEXT NOT NULL,
    "valid_from" DATE NOT NULL,
    "valid_until" DATE,
    "reason" TEXT,
    "actor_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshot_json" JSONB NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT "school_transport_allocation_history_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "school_transport_allocation_history_tenant_id_student_id_created_at_idx"
  ON "school"."school_transport_allocation_history"("tenant_id", "student_id", "created_at");

CREATE TABLE IF NOT EXISTS "school"."school_transport_fee_assignments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "allocation_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "concession_amt" INTEGER NOT NULL DEFAULT 0,
    "net_amount" INTEGER NOT NULL,
    "valid_from" DATE NOT NULL,
    "valid_until" DATE,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_transport_fee_assignments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "school_transport_fee_assignments_tenant_id_student_id_status_idx"
  ON "school"."school_transport_fee_assignments"("tenant_id", "student_id", "status");

CREATE TABLE IF NOT EXISTS "school"."school_transport_trips" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "academic_year_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "route_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "driver_id" UUID,
    "attendant_id" UUID,
    "trip_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "delayed_reason" TEXT,
    "missing_ack" BOOLEAN NOT NULL DEFAULT false,
    "missing_ack_by" UUID,
    "missing_ack_note" TEXT,
    "safety_override" BOOLEAN NOT NULL DEFAULT false,
    "safety_override_by" UUID,
    "safety_override_note" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelled_at" TIMESTAMP(3),
    "cancel_reason" TEXT,
    CONSTRAINT "school_transport_trips_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "school_transport_trips_tenant_id_date_route_id_trip_type_key"
  ON "school"."school_transport_trips"("tenant_id", "date", "route_id", "trip_type");
CREATE INDEX IF NOT EXISTS "school_transport_trips_tenant_id_date_status_idx"
  ON "school"."school_transport_trips"("tenant_id", "date", "status");
CREATE INDEX IF NOT EXISTS "school_transport_trips_tenant_id_vehicle_id_date_idx"
  ON "school"."school_transport_trips"("tenant_id", "vehicle_id", "date");

CREATE TABLE IF NOT EXISTS "school"."school_transport_trip_stops" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "stop_id" UUID NOT NULL,
    "stop_number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "arrived_at" TIMESTAMP(3),
    "departed_at" TIMESTAMP(3),
    CONSTRAINT "school_transport_trip_stops_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "school_transport_trip_stops_trip_id_stop_id_key"
  ON "school"."school_transport_trip_stops"("trip_id", "stop_id");
CREATE INDEX IF NOT EXISTS "school_transport_trip_stops_tenant_id_trip_id_idx"
  ON "school"."school_transport_trip_stops"("tenant_id", "trip_id");

CREATE TABLE IF NOT EXISTS "school"."school_transport_boarding_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "allocation_id" UUID,
    "vehicle_id" UUID,
    "route_id" UUID,
    "stop_id" UUID,
    "event_type" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'MANUAL',
    "recorded_by" UUID,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_transport_boarding_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "school_transport_boarding_events_tenant_id_trip_id_student_id_idx"
  ON "school"."school_transport_boarding_events"("tenant_id", "trip_id", "student_id");
CREATE INDEX IF NOT EXISTS "school_transport_boarding_events_tenant_id_student_id_occurred_at_idx"
  ON "school"."school_transport_boarding_events"("tenant_id", "student_id", "occurred_at");

CREATE TABLE IF NOT EXISTS "school"."school_transport_gps_devices" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "device_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'DEVICE_API',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_transport_gps_devices_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "school_transport_gps_devices_vehicle_id_key"
  ON "school"."school_transport_gps_devices"("vehicle_id");
CREATE UNIQUE INDEX IF NOT EXISTS "school_transport_gps_devices_tenant_id_device_id_key"
  ON "school"."school_transport_gps_devices"("tenant_id", "device_id");

CREATE TABLE IF NOT EXISTS "school"."school_transport_gps_locations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "trip_id" UUID,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "speed_kmh" DECIMAL(6,2),
    "heading" DECIMAL(6,2),
    "accuracy" DECIMAL(8,2),
    "ignition" BOOLEAN,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_transport_gps_locations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "school_transport_gps_locations_tenant_id_vehicle_id_recorded_at_idx"
  ON "school"."school_transport_gps_locations"("tenant_id", "vehicle_id", "recorded_at");

CREATE TABLE IF NOT EXISTS "school"."school_transport_gps_alerts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "trip_id" UUID,
    "kind" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "ack_by" UUID,
    "ack_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_transport_gps_alerts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "school_transport_gps_alerts_tenant_id_kind_created_at_idx"
  ON "school"."school_transport_gps_alerts"("tenant_id", "kind", "created_at");

CREATE TABLE IF NOT EXISTS "school"."school_transport_maintenance" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "service_type" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "odometer" INTEGER,
    "vendor" TEXT,
    "invoice_number" TEXT,
    "cost" INTEGER NOT NULL DEFAULT 0,
    "next_service_date" DATE,
    "next_service_odometer" INTEGER,
    "description" TEXT,
    "attachment_url" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "school_transport_maintenance_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "school_transport_maintenance_tenant_id_vehicle_id_date_idx"
  ON "school"."school_transport_maintenance"("tenant_id", "vehicle_id", "date");
CREATE INDEX IF NOT EXISTS "school_transport_maintenance_tenant_id_next_service_date_idx"
  ON "school"."school_transport_maintenance"("tenant_id", "next_service_date");

CREATE TABLE IF NOT EXISTS "school"."school_transport_fuel_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "odometer" INTEGER NOT NULL,
    "fuel_type" TEXT,
    "litres" DECIMAL(10,2) NOT NULL,
    "rate" INTEGER NOT NULL DEFAULT 0,
    "total_amount" INTEGER NOT NULL,
    "station" TEXT,
    "receipt_no" TEXT,
    "receipt_url" TEXT,
    "driver_id" UUID,
    "route_id" UUID,
    "flags_json" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "school_transport_fuel_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "school_transport_fuel_logs_tenant_id_vehicle_id_date_idx"
  ON "school"."school_transport_fuel_logs"("tenant_id", "vehicle_id", "date");
CREATE INDEX IF NOT EXISTS "school_transport_fuel_logs_tenant_id_receipt_no_idx"
  ON "school"."school_transport_fuel_logs"("tenant_id", "receipt_no");

CREATE TABLE IF NOT EXISTS "school"."school_transport_expenses" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "vehicle_id" UUID,
    "route_id" UUID,
    "date" DATE NOT NULL,
    "category" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "vendor" TEXT,
    "notes" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "school_transport_expenses_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "school_transport_expenses_tenant_id_date_category_idx"
  ON "school"."school_transport_expenses"("tenant_id", "date", "category");

CREATE TABLE IF NOT EXISTS "school"."school_transport_incidents" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "incident_no" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "date" DATE NOT NULL,
    "time" TEXT,
    "vehicle_id" UUID,
    "route_id" UUID,
    "driver_id" UUID,
    "attendant_id" UUID,
    "trip_id" UUID,
    "location" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "description" TEXT NOT NULL,
    "action_taken" TEXT,
    "reported_by" TEXT,
    "assigned_to" TEXT,
    "sos" BOOLEAN NOT NULL DEFAULT false,
    "students_json" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "photos_json" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "ack_at" TIMESTAMP(3),
    "ack_by" UUID,
    "resolved_at" TIMESTAMP(3),
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "school_transport_incidents_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "school_transport_incidents_tenant_id_incident_no_key"
  ON "school"."school_transport_incidents"("tenant_id", "incident_no");
CREATE INDEX IF NOT EXISTS "school_transport_incidents_tenant_id_status_severity_date_idx"
  ON "school"."school_transport_incidents"("tenant_id", "status", "severity", "date");

CREATE TABLE IF NOT EXISTS "school"."school_transport_safety_checklists" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phase" TEXT NOT NULL DEFAULT 'PRE_TRIP',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_transport_safety_checklists_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "school_transport_safety_checklists_tenant_id_phase_active_idx"
  ON "school"."school_transport_safety_checklists"("tenant_id", "phase", "active");

CREATE TABLE IF NOT EXISTS "school"."school_transport_safety_checklist_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "checklist_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "mandatory" BOOLEAN NOT NULL DEFAULT true,
    "requires_photo" BOOLEAN NOT NULL DEFAULT false,
    "requires_remarks" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "school_transport_safety_checklist_items_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "school_transport_safety_checklist_items_checklist_id_code_key"
  ON "school"."school_transport_safety_checklist_items"("checklist_id", "code");

CREATE TABLE IF NOT EXISTS "school"."school_transport_safety_inspections" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "checklist_id" UUID NOT NULL,
    "trip_id" UUID,
    "vehicle_id" UUID NOT NULL,
    "result" TEXT NOT NULL DEFAULT 'PENDING',
    "inspected_by" TEXT,
    "override" BOOLEAN NOT NULL DEFAULT false,
    "override_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_transport_safety_inspections_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "school_transport_safety_inspections_tenant_id_trip_id_idx"
  ON "school"."school_transport_safety_inspections"("tenant_id", "trip_id");

CREATE TABLE IF NOT EXISTS "school"."school_transport_safety_answers" (
    "id" UUID NOT NULL,
    "inspection_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "remarks" TEXT,
    "photo_url" TEXT,
    CONSTRAINT "school_transport_safety_answers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "school_transport_safety_answers_inspection_id_item_id_key"
  ON "school"."school_transport_safety_answers"("inspection_id", "item_id");

CREATE TABLE IF NOT EXISTS "school"."school_transport_calendar_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "academic_year_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "route_id" UUID,
    "academic_event_id" UUID,
    "notes" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "school_transport_calendar_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "school_transport_calendar_events_academic_event_id_key"
  ON "school"."school_transport_calendar_events"("academic_event_id");
CREATE INDEX IF NOT EXISTS "school_transport_calendar_events_tenant_id_academic_year_id_start_date_end_date_idx"
  ON "school"."school_transport_calendar_events"("tenant_id", "academic_year_id", "start_date", "end_date");

CREATE TABLE IF NOT EXISTS "school"."school_transport_notifications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "trip_id" UUID,
    "student_id" UUID,
    "event_type" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'IN_APP',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "payload_json" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_transport_notifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "school_transport_notifications_tenant_id_event_type_created_at_idx"
  ON "school"."school_transport_notifications"("tenant_id", "event_type", "created_at");

CREATE TABLE IF NOT EXISTS "school"."school_transport_audit_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "record_id" TEXT,
    "old_value" JSONB,
    "new_value" JSONB,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_transport_audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "school_transport_audit_logs_tenant_id_created_at_idx"
  ON "school"."school_transport_audit_logs"("tenant_id", "created_at");

CREATE TABLE IF NOT EXISTS "school"."school_transport_geofences" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "radius_meters" INTEGER NOT NULL DEFAULT 100,
    "stop_id" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "school_transport_geofences_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "school_transport_geofences_tenant_id_kind_active_idx"
  ON "school"."school_transport_geofences"("tenant_id", "kind", "active");

CREATE TABLE IF NOT EXISTS "school"."school_transport_requests" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "academic_year_id" UUID,
    "student_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "route_id" UUID,
    "stop_id" UUID,
    "vehicle_id" UUID,
    "valid_from" DATE,
    "valid_until" DATE,
    "reason" TEXT,
    "remarks" TEXT,
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_transport_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "school_transport_requests_tenant_id_status_created_at_idx"
  ON "school"."school_transport_requests"("tenant_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "school_transport_requests_tenant_id_student_id_idx"
  ON "school"."school_transport_requests"("tenant_id", "student_id");

ALTER TABLE "school"."school_transport_settings"
  ADD COLUMN IF NOT EXISTS "policy_json" JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE "school"."school_transport_vehicles"
  ADD COLUMN IF NOT EXISTS "fleet_role" TEXT NOT NULL DEFAULT 'PRIMARY',
  ADD COLUMN IF NOT EXISTS "details_json" JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE "school"."school_transport_stops"
  ADD COLUMN IF NOT EXISTS "safety_json" JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE "school"."school_transport_routes"
  ADD COLUMN IF NOT EXISTS "route_type" TEXT NOT NULL DEFAULT 'BOTH',
  ADD COLUMN IF NOT EXISTS "start_point" TEXT,
  ADD COLUMN IF NOT EXISTS "end_point" TEXT,
  ADD COLUMN IF NOT EXISTS "max_capacity" INTEGER;
ALTER TABLE "school"."school_transport_student_allocations"
  ADD COLUMN IF NOT EXISTS "trip_mode" TEXT NOT NULL DEFAULT 'BOTH',
  ADD COLUMN IF NOT EXISTS "is_temporary" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "temporary_reason" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_transport_vehicle_documents_vehicle_id_fkey') THEN
    ALTER TABLE "school"."school_transport_vehicle_documents"
      ADD CONSTRAINT "school_transport_vehicle_documents_vehicle_id_fkey"
      FOREIGN KEY ("vehicle_id") REFERENCES "school"."school_transport_vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_transport_vehicle_safety_items_vehicle_id_fkey') THEN
    ALTER TABLE "school"."school_transport_vehicle_safety_items"
      ADD CONSTRAINT "school_transport_vehicle_safety_items_vehicle_id_fkey"
      FOREIGN KEY ("vehicle_id") REFERENCES "school"."school_transport_vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_transport_personnel_staff_id_fkey') THEN
    ALTER TABLE "school"."school_transport_personnel"
      ADD CONSTRAINT "school_transport_personnel_staff_id_fkey"
      FOREIGN KEY ("staff_id") REFERENCES "school"."school_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_transport_personnel_documents_personnel_id_fkey') THEN
    ALTER TABLE "school"."school_transport_personnel_documents"
      ADD CONSTRAINT "school_transport_personnel_documents_personnel_id_fkey"
      FOREIGN KEY ("personnel_id") REFERENCES "school"."school_transport_personnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_transport_routes_vehicle_id_fkey') THEN
    ALTER TABLE "school"."school_transport_routes"
      ADD CONSTRAINT "school_transport_routes_vehicle_id_fkey"
      FOREIGN KEY ("vehicle_id") REFERENCES "school"."school_transport_vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_transport_routes_driver_id_fkey') THEN
    ALTER TABLE "school"."school_transport_routes"
      ADD CONSTRAINT "school_transport_routes_driver_id_fkey"
      FOREIGN KEY ("driver_id") REFERENCES "school"."school_transport_personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_transport_routes_attendant_id_fkey') THEN
    ALTER TABLE "school"."school_transport_routes"
      ADD CONSTRAINT "school_transport_routes_attendant_id_fkey"
      FOREIGN KEY ("attendant_id") REFERENCES "school"."school_transport_personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_transport_route_stops_route_id_fkey') THEN
    ALTER TABLE "school"."school_transport_route_stops"
      ADD CONSTRAINT "school_transport_route_stops_route_id_fkey"
      FOREIGN KEY ("route_id") REFERENCES "school"."school_transport_routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_transport_route_stops_stop_id_fkey') THEN
    ALTER TABLE "school"."school_transport_route_stops"
      ADD CONSTRAINT "school_transport_route_stops_stop_id_fkey"
      FOREIGN KEY ("stop_id") REFERENCES "school"."school_transport_stops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_transport_student_allocations_student_id_fkey') THEN
    ALTER TABLE "school"."school_transport_student_allocations"
      ADD CONSTRAINT "school_transport_student_allocations_student_id_fkey"
      FOREIGN KEY ("student_id") REFERENCES "school"."school_students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_transport_student_allocations_route_id_fkey') THEN
    ALTER TABLE "school"."school_transport_student_allocations"
      ADD CONSTRAINT "school_transport_student_allocations_route_id_fkey"
      FOREIGN KEY ("route_id") REFERENCES "school"."school_transport_routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_transport_student_allocations_pickup_stop_id_fkey') THEN
    ALTER TABLE "school"."school_transport_student_allocations"
      ADD CONSTRAINT "school_transport_student_allocations_pickup_stop_id_fkey"
      FOREIGN KEY ("pickup_stop_id") REFERENCES "school"."school_transport_stops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_transport_student_allocations_drop_stop_id_fkey') THEN
    ALTER TABLE "school"."school_transport_student_allocations"
      ADD CONSTRAINT "school_transport_student_allocations_drop_stop_id_fkey"
      FOREIGN KEY ("drop_stop_id") REFERENCES "school"."school_transport_stops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_transport_allocation_history_allocation_id_fkey') THEN
    ALTER TABLE "school"."school_transport_allocation_history"
      ADD CONSTRAINT "school_transport_allocation_history_allocation_id_fkey"
      FOREIGN KEY ("allocation_id") REFERENCES "school"."school_transport_student_allocations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_transport_trips_route_id_fkey') THEN
    ALTER TABLE "school"."school_transport_trips"
      ADD CONSTRAINT "school_transport_trips_route_id_fkey"
      FOREIGN KEY ("route_id") REFERENCES "school"."school_transport_routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_transport_trips_vehicle_id_fkey') THEN
    ALTER TABLE "school"."school_transport_trips"
      ADD CONSTRAINT "school_transport_trips_vehicle_id_fkey"
      FOREIGN KEY ("vehicle_id") REFERENCES "school"."school_transport_vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_transport_boarding_events_trip_id_fkey') THEN
    ALTER TABLE "school"."school_transport_boarding_events"
      ADD CONSTRAINT "school_transport_boarding_events_trip_id_fkey"
      FOREIGN KEY ("trip_id") REFERENCES "school"."school_transport_trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_transport_boarding_events_student_id_fkey') THEN
    ALTER TABLE "school"."school_transport_boarding_events"
      ADD CONSTRAINT "school_transport_boarding_events_student_id_fkey"
      FOREIGN KEY ("student_id") REFERENCES "school"."school_students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_transport_requests_student_id_fkey') THEN
    ALTER TABLE "school"."school_transport_requests"
      ADD CONSTRAINT "school_transport_requests_student_id_fkey"
      FOREIGN KEY ("student_id") REFERENCES "school"."school_students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_transport_gps_devices_vehicle_id_fkey') THEN
    ALTER TABLE "school"."school_transport_gps_devices"
      ADD CONSTRAINT "school_transport_gps_devices_vehicle_id_fkey"
      FOREIGN KEY ("vehicle_id") REFERENCES "school"."school_transport_vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_transport_gps_locations_vehicle_id_fkey') THEN
    ALTER TABLE "school"."school_transport_gps_locations"
      ADD CONSTRAINT "school_transport_gps_locations_vehicle_id_fkey"
      FOREIGN KEY ("vehicle_id") REFERENCES "school"."school_transport_vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_transport_maintenance_vehicle_id_fkey') THEN
    ALTER TABLE "school"."school_transport_maintenance"
      ADD CONSTRAINT "school_transport_maintenance_vehicle_id_fkey"
      FOREIGN KEY ("vehicle_id") REFERENCES "school"."school_transport_vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_transport_fuel_logs_vehicle_id_fkey') THEN
    ALTER TABLE "school"."school_transport_fuel_logs"
      ADD CONSTRAINT "school_transport_fuel_logs_vehicle_id_fkey"
      FOREIGN KEY ("vehicle_id") REFERENCES "school"."school_transport_vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
