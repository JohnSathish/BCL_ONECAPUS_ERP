/**
 * Remove accidental programme records (ECO-100 orphan, EVS mistaken programme).
 *
 *   npx ts-node scripts/cleanup-accidental-programs.ts --dry-run
 *   npx ts-node scripts/cleanup-accidental-programs.ts --apply
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TARGETS = ['ECO-100', 'EVS'];

async function getHardBlockers(programVersionId: string, tenantId: string) {
  const offeringWhere = { tenantId, programVersionId, deletedAt: null };
  const [students, registrations, outcomeRuns, approvalPolicies] =
    await Promise.all([
      prisma.student.count({
        where: { tenantId, programVersionId, deletedAt: null },
      }),
      prisma.registration.count({
        where: {
          tenantId,
          deletedAt: null,
          offering: { programVersionId, deletedAt: null },
        },
      }),
      prisma.outcomeAttainmentRun.count({
        where: { tenantId, programVersionId },
      }),
      prisma.registrationApprovalPolicy.count({
        where: { tenantId, programVersionId },
      }),
    ]);
  const blockers: string[] = [];
  if (students) blockers.push(`${students} student(s)`);
  if (registrations) blockers.push(`${registrations} registration(s)`);
  if (outcomeRuns) blockers.push(`${outcomeRuns} outcome run(s)`);
  if (approvalPolicies)
    blockers.push(`${approvalPolicies} approval polic(ies)`);
  return blockers;
}

async function purgeVersion(
  tenantId: string,
  versionId: string,
  versionNumber: number,
) {
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const offerings = await tx.courseOffering.findMany({
      where: { tenantId, programVersionId: versionId, deletedAt: null },
      select: { id: true },
    });
    const offeringIds = offerings.map((o) => o.id);
    if (offeringIds.length) {
      await tx.offeringSection.updateMany({
        where: {
          tenantId,
          courseOfferingId: { in: offeringIds },
          deletedAt: null,
        },
        data: { deletedAt: now },
      });
      await tx.courseOffering.updateMany({
        where: { tenantId, id: { in: offeringIds } },
        data: { deletedAt: now },
      });
    }
    await tx.programmePoolCourseExclusion.deleteMany({
      where: { tenantId, programVersionId: versionId },
    });
    await tx.programmePoolAssignment.deleteMany({
      where: { tenantId, programVersionId: versionId },
    });
    await tx.semesterStructureRuleLine.deleteMany({
      where: { rule: { tenantId, programVersionId: versionId } },
    });
    await tx.semesterStructureRule.deleteMany({
      where: { tenantId, programVersionId: versionId },
    });
    await tx.staffSubjectAssignment.deleteMany({
      where: { tenantId, programVersionId: versionId },
    });
    await tx.programOutcome.deleteMany({
      where: { tenantId, programVersionId: versionId, deletedAt: null },
    });
    await tx.programVersion.update({
      where: { id: versionId, tenantId },
      data: { deletedAt: now, version: 800000 + versionNumber },
    });
  });
}

async function cleanupProgram(tenantId: string, code: string, apply: boolean) {
  const program = await prisma.program.findFirst({ where: { tenantId, code } });
  if (!program) {
    console.log(`${code}: not found`);
    return;
  }

  const versions = await prisma.programVersion.findMany({
    where: { tenantId, programId: program.id, deletedAt: null },
    orderBy: { version: 'asc' },
  });

  console.log(
    `\n${code}: program deletedAt=${program.deletedAt?.toISOString() ?? 'null'}, versions=${versions.length}`,
  );

  for (const v of versions) {
    const blockers = await getHardBlockers(v.id, tenantId);
    const usage = {
      offerings: await prisma.courseOffering.count({
        where: { tenantId, programVersionId: v.id, deletedAt: null },
      }),
    };
    console.log(
      `  v${v.version} (${v.status}) offerings=${usage.offerings} blockers=${blockers.join(', ') || 'none'}`,
    );
    if (blockers.length) {
      console.log(`  SKIP v${v.version} — has dependencies`);
      continue;
    }
    if (apply) {
      await purgeVersion(tenantId, v.id, v.version);
      console.log(`  PURGED v${v.version}`);
    }
  }

  if (program.deletedAt === null && apply) {
    const remaining = await prisma.programVersion.count({
      where: { tenantId, programId: program.id, deletedAt: null },
    });
    if (remaining === 0) {
      await prisma.program.update({
        where: { id: program.id },
        data: { deletedAt: new Date() },
      });
      console.log(`  SOFT-DELETED programme ${code}`);
    }
  }
}

async function main() {
  const apply = process.argv.includes('--apply');
  console.log(apply ? 'APPLY — making changes' : 'DRY RUN — no changes');

  const tenantId = (await prisma.program.findFirst({
    select: { tenantId: true },
  }))!.tenantId;
  for (const code of TARGETS) {
    await cleanupProgram(tenantId, code, apply);
  }

  if (!apply) console.log('\nRe-run with --apply to execute cleanup.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
