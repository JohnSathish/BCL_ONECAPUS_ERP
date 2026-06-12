-- Designation categories for teaching vs non-teaching vs admin staff

ALTER TABLE "core"."designations" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'TEACHING';

CREATE INDEX "designations_tenant_id_category_idx" ON "core"."designations"("tenant_id", "category");

UPDATE "core"."designations"
SET "category" = 'NON_TEACHING'
WHERE "code" IN (
  'CLERK', 'LIBRARIAN', 'ACCOUNTANT', 'OFFICE_ASSISTANT',
  'LDA', 'UDA', 'GRADE_IV', 'HOUSE_KEEPING', 'PEON', 'RECEPTIONIST',
  'TYPIST', 'DATA_ENTRY_OPERATOR', 'STORE_KEEPER', 'LAB_ASSISTANT',
  'LIBRARY_ASSISTANT', 'SECURITY_STAFF', 'DRIVER', 'ELECTRICIAN',
  'PLUMBER', 'CLEANER', 'HOSTEL_STAFF', 'MAINTENANCE_STAFF'
);

UPDATE "core"."designations"
SET "category" = 'ADMIN'
WHERE "code" IN (
  'ADMIN_OFFICER', 'REGISTRAR', 'ASSISTANT_REGISTRAR', 'SUPERINTENDENT',
  'BURSAR', 'OFFICE_SUPERINTENDENT', 'FINANCE_OFFICER', 'HR_OFFICER',
  'IT_ADMINISTRATOR', 'ERP_ADMINISTRATOR'
);

UPDATE "core"."designations"
SET "category" = 'TEACHING'
WHERE "category" IS NULL OR "category" = 'TEACHING';
