import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    create table if not exists academic.student_major_minor_overrides (
      id uuid primary key default gen_random_uuid(),
      tenant_id uuid not null,
      student_id uuid not null,
      major_subject_id uuid not null,
      minor_subject_id uuid not null,
      program_version_id uuid null,
      shift_id uuid null,
      academic_year_id uuid null,
      effective_from_semester int not null default 1,
      effective_to_semester int null,
      status text not null default 'APPROVED',
      reason text not null,
      approval_authority text not null,
      approved_by_id uuid null,
      approved_at timestamptz null,
      supporting_document_url text null,
      approval_ref text null,
      metadata jsonb null,
      created_by_id uuid null,
      revoked_by_id uuid null,
      revoked_at timestamptz null,
      revoked_reason text null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);
  await prisma.$executeRawUnsafe(`
    create index if not exists idx_smmo_tenant_student_status
      on academic.student_major_minor_overrides (tenant_id, student_id, status);
  `);
  await prisma.$executeRawUnsafe(`
    create index if not exists idx_smmo_tenant_major_minor
      on academic.student_major_minor_overrides (tenant_id, major_subject_id, minor_subject_id);
  `);
  await prisma.$executeRawUnsafe(`
    create index if not exists idx_smmo_scope
      on academic.student_major_minor_overrides (tenant_id, program_version_id, shift_id, academic_year_id);
  `);
  console.log('Ensured table: academic.student_major_minor_overrides');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
