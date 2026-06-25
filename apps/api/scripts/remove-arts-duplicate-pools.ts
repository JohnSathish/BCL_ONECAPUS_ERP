/**
 * Remove duplicate "Arts * Pool" category pools and keep canonical pools
 * (e.g. "MDC Semester 1 Pool"). Migrates active registration lines to the
 * matching canonical offering/section before soft-deleting Arts offerings.
 *
 *   npx tsx scripts/remove-arts-duplicate-pools.ts
 *   npx tsx scripts/remove-arts-duplicate-pools.ts --apply
 *   npx tsx scripts/remove-arts-duplicate-pools.ts --apply --semester=1
 *   npx tsx scripts/remove-arts-duplicate-pools.ts --apply --pool="Arts MDC Semester 3 Pool"
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

const apply = process.argv.includes('--apply');
const tenantSlug = readArg('tenant') ?? 'demo';
const semesterFilter = readArg('semester')
  ? Number(readArg('semester'))
  : undefined;
const poolFilter = readArg('pool');

function canonicalPoolName(categoryType: string, semesterNo: number) {
  return `${categoryType} Semester ${semesterNo} Pool`;
}

async function recalcSeatLedger(
  tx: PrismaClient,
  tenantId: string,
  sectionId: string,
) {
  const section = await tx.offeringSection.findFirst({
    where: { id: sectionId, deletedAt: null },
    select: { id: true },
  });
  if (!section) return;

  const confirmed = await tx.semesterRegistrationLine.count({
    where: { offeringSectionId: sectionId, status: 'confirmed' },
  });
  const waitlisted = await tx.semesterRegistrationLine.count({
    where: { offeringSectionId: sectionId, status: 'waitlisted' },
  });
  await tx.offeringSeatLedger.upsert({
    where: { offeringSectionId: sectionId },
    create: {
      offeringSectionId: sectionId,
      tenantId,
      confirmedCount: confirmed,
      waitlistCount: waitlisted,
    },
    update: {
      confirmedCount: confirmed,
      waitlistCount: waitlisted,
    },
  });
}

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: tenantSlug } });
  if (!tenant) throw new Error(`Tenant "${tenantSlug}" not found`);

  const artsPools = await prisma.categoryPool.findMany({
    where: {
      tenantId: tenant.id,
      poolName: poolFilter ?? { startsWith: 'Arts ' },
      active: true,
      ...(semesterFilter ? { semesterNo: semesterFilter } : {}),
    },
    include: {
      offerings: {
        where: { deletedAt: null },
        include: {
          course: { select: { code: true } },
          sections: {
            where: { deletedAt: null },
            include: { seatLedger: true },
          },
        },
      },
    },
    orderBy: [{ semesterNo: 'asc' }, { categoryType: 'asc' }],
  });

  if (!artsPools.length) {
    console.log('No active Arts duplicate pools found.');
    return;
  }

  console.log(
    `${apply ? 'APPLY' : 'DRY RUN'} | tenant=${tenantSlug} | Arts pools=${artsPools.length}`,
  );

  let migratedLines = 0;
  let removedOfferings = 0;
  let removedPools = 0;
  const blockedPools: string[] = [];

  for (const artsPool of artsPools) {
    const canonicalName = canonicalPoolName(
      artsPool.categoryType,
      artsPool.semesterNo,
    );
    const canonicalPool = await prisma.categoryPool.findFirst({
      where: {
        tenantId: tenant.id,
        institutionId: artsPool.institutionId,
        poolName: canonicalName,
        active: true,
      },
    });

    console.log(`\n${artsPool.poolName} → ${canonicalName}`);

    if (!canonicalPool) {
      console.log(`  SKIP: canonical pool "${canonicalName}" not found`);
      blockedPools.push(artsPool.poolName);
      continue;
    }

    const canonicalOfferings = await prisma.courseOffering.findMany({
      where: {
        tenantId: tenant.id,
        categoryPoolId: canonicalPool.id,
        deletedAt: null,
      },
      include: {
        sections: {
          where: { deletedAt: null },
          orderBy: { sectionCode: 'asc' },
        },
      },
    });
    const canonicalByCourseId = new Map(
      canonicalOfferings.map((o) => [o.courseId, o]),
    );

    const touchedSections = new Set<string>();
    let poolBlocked = false;

    for (const artsOffering of artsPool.offerings) {
      const canonicalOffering = canonicalByCourseId.get(artsOffering.courseId);
      if (!canonicalOffering) {
        const regCount = await prisma.semesterRegistrationLine.count({
          where: {
            offeringId: artsOffering.id,
            status: { in: ['confirmed', 'pending', 'waitlisted'] },
          },
        });
        if (regCount > 0) {
          console.log(
            `  ADOPT ${artsOffering.course.code}: move offering to ${canonicalName} (${regCount} regs)`,
          );
          if (apply) {
            const poolCourseCount = await prisma.categoryPoolCourse.count({
              where: { poolId: canonicalPool.id, active: true },
            });
            await prisma.categoryPoolCourse.upsert({
              where: {
                poolId_courseId: {
                  poolId: canonicalPool.id,
                  courseId: artsOffering.courseId,
                },
              },
              create: {
                poolId: canonicalPool.id,
                courseId: artsOffering.courseId,
                displayOrder: poolCourseCount,
                active: true,
              },
              update: { active: true },
            });
            const adopted = await prisma.courseOffering.update({
              where: { id: artsOffering.id },
              data: { categoryPoolId: canonicalPool.id },
              include: {
                sections: {
                  where: { deletedAt: null },
                  orderBy: { sectionCode: 'asc' },
                },
              },
            });
            canonicalByCourseId.set(artsOffering.courseId, adopted);
          }
        } else {
          console.log(
            `  DROP offering ${artsOffering.course.code} (not in canonical pool, no regs)`,
          );
          if (apply) {
            await prisma.courseOffering.update({
              where: { id: artsOffering.id },
              data: { deletedAt: new Date() },
            });
            removedOfferings += 1;
          }
        }
        continue;
      }

      const lines = await prisma.semesterRegistrationLine.findMany({
        where: {
          offeringId: artsOffering.id,
          status: { in: ['confirmed', 'pending', 'waitlisted'] },
        },
        include: {
          offeringSection: {
            select: { id: true, sectionCode: true, shiftId: true },
          },
        },
      });

      for (const line of lines) {
        const sectionCode = line.offeringSection?.sectionCode ?? 'A';
        const shiftId = line.offeringSection?.shiftId;
        let targetSection = canonicalOffering.sections.find(
          (s) =>
            s.sectionCode === sectionCode &&
            (shiftId == null || s.shiftId === shiftId),
        );
        if (!targetSection) {
          targetSection = canonicalOffering.sections[0];
        }
        if (!targetSection) {
          console.log(
            `  BLOCK line ${line.id.slice(0, 8)}: no section on canonical ${artsOffering.course.code}`,
          );
          poolBlocked = true;
          continue;
        }

        const duplicate = await prisma.semesterRegistrationLine.findFirst({
          where: {
            registrationId: line.registrationId,
            offeringSectionId: targetSection.id,
            id: { not: line.id },
          },
        });

        if (duplicate) {
          console.log(
            `  MERGE ${artsOffering.course.code}[${sectionCode}]: drop duplicate arts line`,
          );
          if (apply) {
            if (line.offeringSectionId) {
              touchedSections.add(line.offeringSectionId);
            }
            await prisma.semesterRegistrationLine.delete({
              where: { id: line.id },
            });
            migratedLines += 1;
          }
          continue;
        }

        console.log(
          `  MOVE ${artsOffering.course.code}[${sectionCode}] → canonical section ${targetSection.sectionCode}`,
        );
        if (apply) {
          if (line.offeringSectionId) {
            touchedSections.add(line.offeringSectionId);
          }
          touchedSections.add(targetSection.id);
          await prisma.semesterRegistrationLine.update({
            where: { id: line.id },
            data: {
              offeringId: canonicalOffering.id,
              offeringSectionId: targetSection.id,
            },
          });
          migratedLines += 1;
        }
      }

      const offeringRemaining = apply
        ? await prisma.semesterRegistrationLine.count({
            where: {
              offeringId: artsOffering.id,
              status: { in: ['confirmed', 'pending', 'waitlisted'] },
            },
          })
        : 0;
      if (offeringRemaining === 0) {
        console.log(`  DROP offering ${artsOffering.course.code}`);
        if (apply) {
          await prisma.courseOffering.update({
            where: { id: artsOffering.id },
            data: { deletedAt: new Date() },
          });
          removedOfferings += 1;
        }
      }
    }

    const lingeringOfferings = apply
      ? await prisma.courseOffering.count({
          where: { categoryPoolId: artsPool.id, deletedAt: null },
        })
      : 0;

    if (apply && lingeringOfferings > 0) {
      poolBlocked = true;
      console.log(
        `  Pool kept (${lingeringOfferings} offering(s) still linked to arts pool)`,
      );
    }

    if (poolBlocked) {
      blockedPools.push(artsPool.poolName);
      console.log(`  Pool kept (unmigrated registrations remain)`);
      continue;
    }

    console.log(`  DELETE pool ${artsPool.poolName}`);
    if (apply) {
      await prisma.$transaction(async (tx) => {
        await tx.courseOffering.updateMany({
          where: { categoryPoolId: artsPool.id, tenantId: tenant.id },
          data: { deletedAt: new Date() },
        });
        await tx.categoryPoolCourse.deleteMany({
          where: { poolId: artsPool.id },
        });
        await tx.categoryPool.delete({ where: { id: artsPool.id } });
      });
      removedPools += 1;

      for (const sectionId of touchedSections) {
        await recalcSeatLedger(prisma, tenant.id, sectionId);
      }
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Migrated lines: ${migratedLines}`);
  console.log(`Removed offerings: ${removedOfferings}`);
  console.log(`Removed pools: ${removedPools}`);
  if (blockedPools.length) {
    console.log(`Blocked pools: ${blockedPools.join(', ')}`);
  }
  if (!apply) {
    console.log('\nRe-run with --apply to execute changes.');
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
