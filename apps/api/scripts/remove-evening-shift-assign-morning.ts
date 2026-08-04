/**
 * Remove college Evening Shift: reassign affected staff to Morning, then soft-delete Evening.
 *
 * Run (from apps/api):
 *   npx ts-node --transpile-only scripts/remove-evening-shift-assign-morning.ts
 *
 * Optional:
 *   TENANT_SLUG=demo npx ts-node --transpile-only scripts/remove-evening-shift-assign-morning.ts
 *   DRY_RUN=1 npx ts-node --transpile-only scripts/remove-evening-shift-assign-morning.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

async function resolveTenantId() {
  const slug = process.env.TENANT_SLUG?.trim();
  if (slug) {
    const bySlug = await prisma.tenant.findFirst({ where: { slug } });
    if (bySlug) return bySlug;
  }
  const byName = await prisma.tenant.findFirst({
    where: { name: { contains: 'Don Bosco', mode: 'insensitive' } },
  });
  if (byName) return byName;
  return prisma.tenant.findFirst({ orderBy: { createdAt: 'asc' } });
}

async function main() {
  const tenant = await resolveTenantId();
  if (!tenant) throw new Error('Tenant not found');

  console.log(
    `${dryRun ? '[DRY RUN] ' : ''}Tenant: ${tenant.name} (${tenant.id})`,
  );

  const eveningShifts = await prisma.shift.findMany({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      OR: [
        { code: { equals: 'EVENING', mode: 'insensitive' } },
        { name: { contains: 'Evening', mode: 'insensitive' } },
      ],
    },
  });

  if (!eveningShifts.length) {
    console.log('No active Evening Shift rows found. Nothing to do.');
    return;
  }

  console.log(
    `Found ${eveningShifts.length} Evening Shift row(s):`,
    eveningShifts.map(
      (s) => `${s.code}/${s.name} (${s.id}) status=${s.status}`,
    ),
  );

  let staffMoved = 0;
  let assignmentsFixed = 0;
  let subjectShiftFixed = 0;
  let userRolesFixed = 0;
  let userShiftAssignmentsFixed = 0;
  let eveningsSoftDeleted = 0;

  for (const evening of eveningShifts) {
    const morning = await prisma.shift.findFirst({
      where: {
        tenantId: tenant.id,
        campusId: evening.campusId,
        deletedAt: null,
        code: { equals: 'MORNING', mode: 'insensitive' },
        status: 'ACTIVE',
      },
      orderBy: { sortOrder: 'asc' },
    });

    if (!morning) {
      throw new Error(
        `No ACTIVE Morning Shift on campus ${evening.campusId} for Evening ${evening.id}`,
      );
    }

    console.log(
      `\nEvening ${evening.code} → Morning ${morning.code} (${morning.id})`,
    );

    const staffOnEvening = await prisma.staffProfile.findMany({
      where: {
        tenantId: tenant.id,
        deletedAt: null,
        OR: [
          { primaryShiftId: evening.id },
          { teachingShiftCategory: { equals: 'EVENING', mode: 'insensitive' } },
          {
            shiftAssignments: {
              some: { shiftId: evening.id, active: true },
            },
          },
        ],
      },
      select: {
        id: true,
        fullName: true,
        employeeCode: true,
        primaryShiftId: true,
        teachingShiftCategory: true,
      },
      orderBy: { employeeCode: 'asc' },
    });

    console.log(`Staff to move: ${staffOnEvening.length}`);
    for (const staff of staffOnEvening) {
      console.log(
        `  - ${staff.employeeCode ?? '—'} ${staff.fullName} (cat=${staff.teachingShiftCategory})`,
      );

      if (dryRun) {
        staffMoved += 1;
        continue;
      }

      await prisma.$transaction(async (tx) => {
        await tx.staffProfile.update({
          where: { id: staff.id },
          data: {
            primaryShiftId: morning.id,
            teachingShiftCategory: 'MORNING',
          },
        });

        // Deactivate / remove Evening assignments
        await tx.staffShiftAssignment.updateMany({
          where: {
            tenantId: tenant.id,
            staffProfileId: staff.id,
            shiftId: evening.id,
          },
          data: { active: false, isPrimary: false },
        });

        const existingMorning = await tx.staffShiftAssignment.findFirst({
          where: {
            staffProfileId: staff.id,
            shiftId: morning.id,
          },
        });
        if (existingMorning) {
          await tx.staffShiftAssignment.update({
            where: { id: existingMorning.id },
            data: { active: true, isPrimary: true },
          });
        } else {
          await tx.staffShiftAssignment.create({
            data: {
              tenantId: tenant.id,
              staffProfileId: staff.id,
              shiftId: morning.id,
              active: true,
              isPrimary: true,
            },
          });
        }

        // Keep only Morning as primary among remaining actives
        await tx.staffShiftAssignment.updateMany({
          where: {
            staffProfileId: staff.id,
            shiftId: { not: morning.id },
            active: true,
            isPrimary: true,
          },
          data: { isPrimary: false },
        });
      });

      staffMoved += 1;
    }

    // Any leftover assignment rows (orphan references)
    const leftoverAssignments = await prisma.staffShiftAssignment.findMany({
      where: { tenantId: tenant.id, shiftId: evening.id, active: true },
      select: { id: true, staffProfileId: true },
    });
    if (leftoverAssignments.length) {
      console.log(
        `Deactivating ${leftoverAssignments.length} leftover StaffShiftAssignment(s)`,
      );
      if (!dryRun) {
        await prisma.staffShiftAssignment.updateMany({
          where: { id: { in: leftoverAssignments.map((a) => a.id) } },
          data: { active: false, isPrimary: false },
        });
      }
      assignmentsFixed += leftoverAssignments.length;
    }

    // Staff subject assignments pinned to Evening → Morning
    const subjectRows = await prisma.staffSubjectAssignment.count({
      where: { tenantId: tenant.id, shiftId: evening.id },
    });
    if (subjectRows > 0) {
      console.log(
        `Remapping ${subjectRows} StaffSubjectAssignment.shiftId → Morning`,
      );
      if (!dryRun) {
        await prisma.staffSubjectAssignment.updateMany({
          where: { tenantId: tenant.id, shiftId: evening.id },
          data: { shiftId: morning.id },
        });
      }
      subjectShiftFixed += subjectRows;
    }

    const eveningRoles = await prisma.userRole.count({
      where: { shiftId: evening.id, deletedAt: null },
    });
    if (eveningRoles > 0) {
      console.log(`Remapping ${eveningRoles} UserRole.shiftId → Morning`);
      if (!dryRun) {
        await prisma.userRole.updateMany({
          where: { shiftId: evening.id, deletedAt: null },
          data: { shiftId: morning.id },
        });
      }
      userRolesFixed += eveningRoles;
    }

    const eveningUsa = await prisma.userShiftAssignment.count({
      where: { shiftId: evening.id },
    });
    if (eveningUsa > 0) {
      console.log(
        `Moving ${eveningUsa} UserShiftAssignment(s) Evening → Morning`,
      );
      if (!dryRun) {
        const rows = await prisma.userShiftAssignment.findMany({
          where: { shiftId: evening.id },
        });
        for (const row of rows) {
          const already = await prisma.userShiftAssignment.findFirst({
            where: { userId: row.userId, shiftId: morning.id },
          });
          if (already) {
            await prisma.userShiftAssignment.delete({ where: { id: row.id } });
          } else {
            await prisma.userShiftAssignment.update({
              where: { id: row.id },
              data: { shiftId: morning.id },
            });
          }
        }
      }
      userShiftAssignmentsFixed += eveningUsa;
    }

    if (!dryRun) {
      await prisma.shift.update({
        where: { id: evening.id },
        data: {
          status: 'INACTIVE',
          deletedAt: new Date(),
          description:
            'Soft-deleted: college no longer operates Evening Shift; staff moved to Morning.',
        },
      });
    }
    eveningsSoftDeleted += 1;
    console.log(
      dryRun
        ? `[DRY RUN] Would soft-delete Evening Shift ${evening.id}`
        : `Soft-deleted Evening Shift ${evening.id}`,
    );
  }

  console.log('\nSummary');
  console.log(`  Staff moved to Morning: ${staffMoved}`);
  console.log(`  Extra assignments deactivated: ${assignmentsFixed}`);
  console.log(`  Subject assignment shifts remapped: ${subjectShiftFixed}`);
  console.log(`  User roles remapped: ${userRolesFixed}`);
  console.log(
    `  User shift assignments remapped: ${userShiftAssignmentsFixed}`,
  );
  console.log(`  Evening shifts soft-deleted: ${eveningsSoftDeleted}`);

  // Normalize leftover EVENING rows (e.g. deletedAt set earlier but status still ACTIVE)
  if (!dryRun) {
    const leftover = await prisma.shift.updateMany({
      where: {
        tenantId: tenant.id,
        OR: [
          { code: { equals: 'EVENING', mode: 'insensitive' } },
          { name: { contains: 'Evening', mode: 'insensitive' } },
        ],
        NOT: {
          AND: [{ status: 'INACTIVE' }, { deletedAt: { not: null } }],
        },
      },
      data: {
        status: 'INACTIVE',
        deletedAt: new Date(),
        description:
          'Soft-deleted: college no longer operates Evening Shift; staff moved to Morning.',
      },
    });
    if (leftover.count > 0) {
      console.log(
        `Normalized ${leftover.count} leftover Evening Shift row(s) to INACTIVE + deleted`,
      );
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
