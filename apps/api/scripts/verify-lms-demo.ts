/**
 * Verify LMS workspaces for demo tenant students.
 *
 *   npx ts-node --transpile-only scripts/verify-lms-demo.ts --tenant=demo
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

const tenantSlug = readArg('tenant') ?? 'demo';
const ENROLLED = ['approved', 'confirmed', 'registered', 'pending'];

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: tenantSlug } });
  if (!tenant) throw new Error(`Tenant not found: ${tenantSlug}`);

  const workspaceCount = await prisma.lmsWorkspace.count({
    where: { tenantId: tenant.id, deletedAt: null, status: 'ACTIVE' },
  });

  const students = await prisma.student.findMany({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      enrollmentNumber: { startsWith: 'APP-2026-' },
    },
    select: { id: true, enrollmentNumber: true },
  });

  let pass = 0;
  let fail = 0;

  console.log(
    `LMS verification — tenant=${tenantSlug}, workspaces=${workspaceCount}, students=${students.length}\n`,
  );

  for (const student of students) {
    const lines = await prisma.semesterRegistrationLine.findMany({
      where: {
        tenantId: tenant.id,
        status: { in: ENROLLED },
        registration: { studentId: student.id, semesterSequence: 1 },
      },
      select: { offeringSectionId: true, offeringId: true },
    });

    const sectionIds = lines
      .map((l) => l.offeringSectionId)
      .filter(Boolean) as string[];
    const offeringIds = [...new Set(lines.map((l) => l.offeringId))];

    const accessible = await prisma.lmsWorkspace.count({
      where: {
        tenantId: tenant.id,
        deletedAt: null,
        OR: [
          { offeringSectionId: { in: sectionIds } },
          { workspaceType: 'POOL', courseOfferingId: { in: offeringIds } },
        ],
      },
    });

    const expected = lines.length;
    if (accessible >= expected) {
      pass += 1;
      console.log(
        `PASS — ${student.enrollmentNumber}: ${accessible} workspace(s) for ${expected} enrolment line(s)`,
      );
    } else {
      fail += 1;
      console.log(
        `FAIL — ${student.enrollmentNumber}: ${accessible}/${expected} workspaces`,
      );
    }
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  if (workspaceCount === 0) {
    console.error(
      'No workspaces — run: npm run provision:lms-workspaces -w api',
    );
    process.exit(1);
  }
  process.exit(fail > 0 ? 1 : 0);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
