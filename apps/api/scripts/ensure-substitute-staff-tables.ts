import { PrismaClient } from '@prisma/client';

const SQL = `
CREATE TABLE IF NOT EXISTS academic.substitute_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  substitute_code TEXT NOT NULL,
  full_name TEXT NOT NULL,
  gender TEXT,
  date_of_birth DATE,
  mobile TEXT,
  email TEXT,
  address TEXT,
  qualification TEXT,
  specialization TEXT,
  department_id UUID,
  category TEXT NOT NULL DEFAULT 'REPLACEMENT_FACULTY',
  photo_url TEXT,
  joining_date DATE,
  relieving_date DATE,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  linked_staff_profile_id UUID UNIQUE,
  created_by_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS substitute_staff_tenant_code_idx
  ON academic.substitute_staff (tenant_id, substitute_code);

CREATE TABLE IF NOT EXISTS academic.substitute_staff_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  substitute_staff_id UUID NOT NULL REFERENCES academic.substitute_staff(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  file_name TEXT,
  file_url TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  remarks TEXT,
  uploaded_by_id UUID,
  verified_by_id UUID,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS academic.replacement_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  assignment_code TEXT,
  original_staff_profile_id UUID NOT NULL,
  substitute_staff_id UUID NOT NULL REFERENCES academic.substitute_staff(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  department_id UUID,
  salary_arrangement TEXT NOT NULL,
  monthly_agreed_amount NUMERIC(12,2),
  full_workload_transfer BOOLEAN NOT NULL DEFAULT FALSE,
  remarks TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  leave_application_id UUID,
  approved_by_id UUID,
  approved_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  ended_by_id UUID,
  created_by_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS academic.replacement_assignment_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  assignment_id UUID NOT NULL REFERENCES academic.replacement_assignments(id) ON DELETE CASCADE,
  course_id UUID,
  offering_section_id UUID,
  subject_label TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS academic.replacement_assignment_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  assignment_id UUID NOT NULL REFERENCES academic.replacement_assignments(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor_id UUID,
  before_state JSONB,
  after_state JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

async function main() {
  const prisma = new PrismaClient();
  const statements = SQL.split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }
  console.log('Substitute / replacement tables ready');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
