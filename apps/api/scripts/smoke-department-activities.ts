/**
 * Smoke-check Department Activities Phase 1 API wiring (types + DB tables).
 *
 * Usage (from apps/api):
 *   npx tsx scripts/smoke-department-activities.ts
 *   npx tsx scripts/smoke-department-activities.ts --tenant=demo
 */
import { PrismaClient } from '@prisma/client';
import { DEPARTMENT_ACTIVITY_TYPES } from '../src/modules/department-activities/domain/activity-types';

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

const tenantSlug = readArg('tenant') ?? 'demo';
const prisma = new PrismaClient();

async function main() {
  console.log(`Department Activities smoke — tenant=${tenantSlug}`);
  console.log(`Activity types catalog: ${DEPARTMENT_ACTIVITY_TYPES.length}`);

  const tenant = await prisma.tenant.findFirst({
    where: { slug: tenantSlug, deletedAt: null },
    select: { id: true },
  });
  if (!tenant) throw new Error(`Tenant not found: ${tenantSlug}`);

  const depts = await prisma.department.count({
    where: { tenantId: tenant.id, deletedAt: null, departmentType: 'ACADEMIC' },
  });
  const activities = await prisma.departmentActivity.count({
    where: { tenantId: tenant.id, deletedAt: null },
  });
  const regs = await prisma.departmentActivityRegistration.count({
    where: { tenantId: tenant.id },
  });

  console.log(`Academic departments: ${depts}`);
  console.log(`Activities rows: ${activities}`);
  console.log(`Registration rows: ${regs}`);
  console.log('OK — tables reachable and type catalog loaded.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
