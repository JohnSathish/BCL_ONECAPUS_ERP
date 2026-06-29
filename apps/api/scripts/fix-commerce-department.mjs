/**
 * Point commerce records from deleted AFB department to active COM (Commerce).
 *
 * Usage:
 *   node scripts/fix-commerce-department.mjs
 *   node scripts/fix-commerce-department.mjs --apply
 *   node scripts/fix-commerce-department.mjs --apply --tenant=demo
 */
import { PrismaClient } from '@prisma/client';

const APPLY = process.argv.includes('--apply');
const tenantArg = process.argv.find((a) => a.startsWith('--tenant='));
const tenantSlug = tenantArg?.split('=')[1]?.trim();

const p = new PrismaClient();

async function reassignTable(label, updateMany) {
  if (!APPLY) return 0;
  const result = await updateMany();
  return result.count;
}

async function fixTenant(tenantId, tenantLabel) {
  const comDept = await p.department.findFirst({
    where: { tenantId, code: 'COM', deletedAt: null, status: 'ACTIVE' },
    select: { id: true, name: true },
  });
  if (!comDept) {
    console.log(`[${tenantLabel}] Skip — active COM department not found`);
    return;
  }

  const afbDepts = await p.department.findMany({
    where: { tenantId, code: 'AFB' },
    select: { id: true, deletedAt: true },
  });
  const afbIds = afbDepts.map((d) => d.id);
  if (!afbIds.length) {
    console.log(`[${tenantLabel}] No AFB department rows — nothing to migrate`);
    return;
  }

  const counts = {
    academicSubjects: await p.academicSubject.count({
      where: { tenantId, departmentId: { in: afbIds } },
    }),
    students: await p.student.count({
      where: { tenantId, deletedAt: null, departmentId: { in: afbIds } },
    }),
    courses: await p.course.count({
      where: { tenantId, deletedAt: null, departmentId: { in: afbIds } },
    }),
    staff: await p.staffProfile.count({
      where: { tenantId, deletedAt: null, departmentId: { in: afbIds } },
    }),
    programs: await p.program.count({
      where: { tenantId, deletedAt: null, departmentId: { in: afbIds } },
    }),
  };

  console.log(
    `\n[${tenantLabel}] COM department: ${comDept.name} (${comDept.id})`,
  );
  console.log(
    `[${tenantLabel}] AFB department rows: ${afbIds.length} (including deleted)`,
  );
  console.log(`[${tenantLabel}] Records to move to COM:`, counts);

  if (!APPLY) {
    console.log(`[${tenantLabel}] Dry run — pass --apply to update`);
    return;
  }

  const updated = {
    academicSubjects: await reassignTable('academicSubjects', () =>
      p.academicSubject.updateMany({
        where: { tenantId, departmentId: { in: afbIds } },
        data: { departmentId: comDept.id },
      }),
    ),
    students: await reassignTable('students', () =>
      p.student.updateMany({
        where: { tenantId, departmentId: { in: afbIds } },
        data: { departmentId: comDept.id },
      }),
    ),
    courses: await reassignTable('courses', () =>
      p.course.updateMany({
        where: { tenantId, departmentId: { in: afbIds } },
        data: { departmentId: comDept.id },
      }),
    ),
    staff: await reassignTable('staff', () =>
      p.staffProfile.updateMany({
        where: { tenantId, departmentId: { in: afbIds } },
        data: { departmentId: comDept.id },
      }),
    ),
    programs: await reassignTable('programs', () =>
      p.program.updateMany({
        where: { tenantId, departmentId: { in: afbIds } },
        data: { departmentId: comDept.id },
      }),
    ),
  };

  console.log(`[${tenantLabel}] Updated:`, updated);

  // Ensure Accounting For Business subject path stays on COM after migration
  await p.academicSubject.updateMany({
    where: { tenantId, slug: 'accounting-for-business' },
    data: { departmentId: comDept.id, programmeGroup: 'COMMERCE' },
  });
}

async function main() {
  const tenants = tenantSlug
    ? await p.tenant.findMany({ where: { slug: tenantSlug } })
    : await p.tenant.findMany({ where: { deletedAt: null } });

  if (!tenants.length) {
    throw new Error(
      tenantSlug ? `Tenant not found: ${tenantSlug}` : 'No tenants found',
    );
  }

  console.log(APPLY ? 'APPLY mode' : 'DRY RUN');
  for (const tenant of tenants) {
    await fixTenant(tenant.id, tenant.slug);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
